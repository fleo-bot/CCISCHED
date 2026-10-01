"""
routes/audit.py
---------------
Chairperson-only, READ-ONLY view of the audit log.

GET /api/audit-logs          — paginated + filterable list
GET /api/audit-logs/export   — same filters, downloaded as CSV

There is intentionally no POST/PUT/PATCH/DELETE here: the log can't be edited
or cleared through the API.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta

from flask import Blueprint, Response, jsonify, request
from sqlalchemy import or_

from database import db
from models import AuditLog
from routes.auth import login_required, role_required

audit_bp = Blueprint("audit", __name__, url_prefix="/api/audit-logs")


def _filtered_query():
    q = AuditLog.query

    role = request.args.get("role")
    if role in ("faculty", "chairperson"):
        q = q.filter(AuditLog.user_role == role)

    if request.args.get("user_id", type=int):
        q = q.filter(AuditLog.user_id == request.args.get("user_id", type=int))

    if request.args.get("category"):
        q = q.filter(AuditLog.category == request.args["category"])

    outcome = request.args.get("outcome")
    if outcome == "success":
        q = q.filter(AuditLog.success.is_(True))
    elif outcome == "failed":
        q = q.filter(AuditLog.success.is_(False))

    search = (request.args.get("q") or "").strip()
    if search:
        like = f"%{search}%"
        q = q.filter(or_(AuditLog.user_name.ilike(like),
                         AuditLog.action.ilike(like),
                         AuditLog.description.ilike(like)))

    # Dates are yyyy-mm-dd (UTC); date_to is inclusive.
    try:
        if request.args.get("date_from"):
            q = q.filter(AuditLog.created_at >= datetime.strptime(request.args["date_from"], "%Y-%m-%d"))
        if request.args.get("date_to"):
            q = q.filter(AuditLog.created_at < datetime.strptime(request.args["date_to"], "%Y-%m-%d") + timedelta(days=1))
    except ValueError:
        pass

    return q.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())


@audit_bp.get("")
@login_required
@role_required("chairperson")
def list_audit_logs():
    page     = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 25, type=int), 1), 100)

    pagination = _filtered_query().paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "logs":     [row.to_dict() for row in pagination.items],
        "total":    pagination.total,
        "page":     pagination.page,
        "pages":    pagination.pages,
        "per_page": per_page,
    }), 200


@audit_bp.get("/filters")
@login_required
@role_required("chairperson")
def audit_filters():
    """Values for the filter dropdowns."""
    cats  = [c for (c,) in db.session.query(AuditLog.category).distinct().order_by(AuditLog.category) if c]
    users = (db.session.query(AuditLog.user_id, AuditLog.user_name, AuditLog.user_role)
             .filter(AuditLog.user_id.isnot(None)).distinct().all())
    seen, out = set(), []
    for uid, name, role in users:
        if uid in seen:
            continue
        seen.add(uid)
        out.append({"id": uid, "name": name, "role": role})
    out.sort(key=lambda u: (u["name"] or "").lower())
    return jsonify({"categories": cats, "users": out}), 200


@audit_bp.get("/export")
@login_required
@role_required("chairperson")
def export_audit_logs():
    rows = _filtered_query().limit(50000).all()
    buf  = io.StringIO()
    w    = csv.writer(buf)
    w.writerow(["Time (UTC)", "User", "Role", "Category", "Action", "Description",
                "Outcome", "Status", "Method", "Path", "IP"])
    for r in rows:
        w.writerow([r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
                    r.user_name, r.user_role, r.category, r.action, r.description,
                    "success" if r.success else "failed", r.status_code,
                    r.method, r.path, r.ip_address])
    return Response(buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=audit_log.csv"})
