"""
routes/notifications.py
-----------------------
GET   /api/notifications           — get all notifications for current user
GET   /api/notifications/unread    — unread count only
PATCH /api/notifications/<id>/read — mark one as read
PATCH /api/notifications/read-all  — mark all as read
"""

from flask import Blueprint, jsonify

from database import db
from models import Notification
from routes.auth import current_user, login_required

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@notifications_bp.get("")
@login_required
def get_notifications():
    user  = current_user()
    notifs = (
        Notification.query
        .filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return jsonify({
        "notifications": [n.to_dict() for n in notifs],
        "unread_count":  sum(1 for n in notifs if not n.is_read),
    }), 200


@notifications_bp.get("/unread")
@login_required
def unread_count():
    user  = current_user()
    count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return jsonify({"unread_count": count}), 200


@notifications_bp.patch("/<int:notif_id>/read")
@login_required
def mark_read(notif_id: int):
    user  = current_user()
    notif = db.session.get(Notification, notif_id)

    if not notif:
        return jsonify({"error": "Notification not found."}), 404
    if notif.user_id != user.id:
        return jsonify({"error": "Forbidden."}), 403

    notif.is_read = True
    db.session.commit()
    return jsonify({"message": "Marked as read."}), 200


@notifications_bp.patch("/read-all")
@login_required
def mark_all_read():
    user = current_user()
    Notification.query.filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "All notifications marked as read."}), 200
