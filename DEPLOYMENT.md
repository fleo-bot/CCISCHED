# CCISched Deployment Guide

This guide walks you through deploying CCISched to production using **Render** (backend) and **Vercel** (frontend) - both free tiers.

---

## 📋 Prerequisites

- [ ] GitHub account
- [ ] Render account (sign up at [render.com](https://render.com))
- [ ] Vercel account (sign up at [vercel.com](https://vercel.com))
- [ ] Your project pushed to a GitHub repository

---

## 🚀 Part 1: Deploy Backend to Render

### Step 1: Create Render Account & Connect GitHub

1. Go to [render.com](https://render.com) and sign up
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub account
4. Select your **CCISched** repository

### Step 2: Deploy Using Blueprint

1. Render will automatically detect the `render.yaml` file
2. Click **"Apply"** to create services
3. This will create:
   - **Web Service**: `ccisched-backend` (Flask API)
   - **Database**: `ccisched-db` (MySQL)

### Step 3: Configure Environment Variables

After deployment, go to your **ccisched-backend** service:

1. Click on **Environment** tab
2. Generate a secure SECRET_KEY:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
3. Add/Update these variables:
   - `SECRET_KEY`: (paste the generated key)
   - `DATABASE_URL`: (auto-injected by Render)
   - `FLASK_ENV`: `production`
   - `PORT`: `10000`

### Step 4: Initialize Database

1. Go to **Shell** tab in your web service
2. Run these commands:
   ```bash
   cd backend
   python init_db.py
   ```
3. This creates all database tables and imports initial data

### Step 5: Get Your Backend URL

- Your backend will be available at: `https://ccisched-backend.onrender.com`
- Copy this URL - you'll need it for the frontend

**⚠️ Important Free Tier Note:**
- Free tier spins down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds (cold start)
- Keep the service active by visiting it regularly

---

## 🌐 Part 2: Deploy Frontend to Vercel

### Step 1: Connect Vercel to GitHub

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your **CCISched** repository

### Step 2: Configure Project Settings

1. **Framework Preset**: Select **"Other"** (static site)
2. **Root Directory**: Leave as `./` (root)
3. **Build Command**: Leave empty or use `echo 'Static site'`
4. **Output Directory**: `src`
5. Click **"Deploy"**

### Step 3: Update Frontend API Configuration

After deployment, you need to update your frontend to point to the Render backend:

1. Get your Vercel URL (e.g., `https://ccisched.vercel.app`)
2. Open `src/scripts/api.js` in your repository
3. Update the API base URL:
   ```javascript
   const API_BASE_URL = 'https://ccisched-backend.onrender.com/api';
   ```
4. Commit and push - Vercel will auto-redeploy

### Step 4: Update CORS Settings

Go back to Render backend:

1. Open `backend/app.py` (in your repository)
2. Update the CORS origins to include your Vercel URL:
   ```python
   CORS(app, supports_credentials=True, origins=[
       "https://ccisched.vercel.app",  # Add your Vercel URL
       "https://your-custom-domain.com",  # If you have one
   ])
   ```
3. Commit and push - Render will auto-redeploy

---

## 🔧 Part 3: Post-Deployment Configuration

### Update Cookie Settings (Backend)

Your backend `app.py` already has the correct cookie settings:
```python
app.config["SESSION_COOKIE_SAMESITE"] = "None"
app.config["SESSION_COOKIE_SECURE"]   = True
```

This allows cross-origin authentication between Vercel (frontend) and Render (backend).

### Verify Deployment

Test these endpoints:

1. **Backend Health Check**:
   ```
   https://ccisched-backend.onrender.com/api/health
   ```
   Should return: `{"status": "ok", ...}`

2. **Frontend**:
   ```
   https://ccisched.vercel.app
   ```
   Should load the login page

3. **Login Test**:
   - Try logging in with a test account
   - Check browser console for any CORS errors

---

## 📊 Database Management

### Access Database (Render Dashboard)

1. Go to Render Dashboard → **ccisched-db**
2. Click **"Connect"** → **External Connection**
3. Use these credentials with MySQL Workbench or any MySQL client:
   - **Host**: (provided by Render)
   - **Port**: (provided by Render)
   - **Username**: `ccisched_user`
   - **Password**: (provided by Render)
   - **Database**: `ccisched`

### Backup Database

```bash
# From Render Shell
mysqldump -h <host> -u ccisched_user -p ccisched > backup.sql
```

### Import Data to Production

If you have CSV files to import:

1. Go to chairperson dashboard → **Import Data**
2. Upload your CSV files:
   - Faculty
   - Courses
   - Sections
   - Rooms
   - Qualifications
   - etc.

---

## 🛠️ Troubleshooting

### Issue: "Database connection failed"

**Solution:**
1. Check if DATABASE_URL is set correctly in Render
2. Verify MySQL service is running
3. Check database credentials

### Issue: "CORS error in browser console"

**Solution:**
1. Verify your Vercel URL is added to CORS origins in `app.py`
2. Redeploy backend after updating CORS settings
3. Clear browser cache and cookies

### Issue: "Login not working / Session lost"

**Solution:**
1. Verify cookie settings:
   ```python
   SESSION_COOKIE_SAMESITE = "None"
   SESSION_COOKIE_SECURE = True
   ```
2. Check browser console for cookie errors
3. Make sure both frontend and backend use HTTPS

### Issue: "Backend is slow / timing out"

**Solution:**
- Free tier spins down after 15 min inactivity
- First request after spin-down takes 30-60 seconds
- Consider upgrading to paid tier ($7/month) for always-on service
- Or use a service like [UptimeRobot](https://uptimerobot.com) to ping your backend every 5 minutes

### Issue: "Import data fails"

**Solution:**
1. Check CSV file format matches expected columns
2. Verify file encoding is UTF-8
3. Check backend logs in Render dashboard

---

## 🔐 Security Checklist

Before going live:

- [ ] Change `SECRET_KEY` to a strong random value
- [ ] Update `DATABASE_URL` to production MySQL
- [ ] Set `FLASK_ENV=production`
- [ ] Update CORS origins to only include your domain
- [ ] Remove any test/demo accounts
- [ ] Set up database backups (Render provides automatic backups)
- [ ] Enable HTTPS (automatic on Render & Vercel)
- [ ] Review and restrict database access
- [ ] Set up monitoring/alerting

---

## 📈 Monitoring & Maintenance

### Render Dashboard

- View logs: **Logs** tab
- Check metrics: **Metrics** tab
- Database status: Database service page

### Vercel Dashboard

- View deployments: **Deployments** tab
- Check analytics: **Analytics** tab
- View logs: Click any deployment → **Logs**

### Recommended Monitoring

- Set up [UptimeRobot](https://uptimerobot.com) to monitor uptime
- Use Render's built-in metrics for performance monitoring
- Set up error tracking (e.g., Sentry) for production errors

---

## 💰 Cost Breakdown (Free Tier)

| Service | Free Tier | Limitations |
|---------|-----------|-------------|
| **Render Web Service** | 750 hours/month | Spins down after 15 min inactivity |
| **Render MySQL** | Free forever | 1GB storage, 1 database |
| **Vercel** | Unlimited | 100GB bandwidth/month |
| **Total** | **$0/month** | Good for demos & capstone projects |

### Upgrade Options (if needed)

- **Render Starter**: $7/month (always-on, no spin-down)
- **Render MySQL**: $15/month (10GB storage, better performance)
- **Vercel Pro**: $20/month (more bandwidth, analytics)

---

## 🎓 Capstone Project Notes

For academic/capstone projects:

1. **Free tier is sufficient** for demonstration and grading
2. **Document the cold start behavior** in your documentation
3. **Include screenshots** of working deployment in your paper
4. **Keep deployment active** during presentation/defense period
5. **Create a backup** before final presentation

---

## 📞 Support & Resources

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Flask Deployment**: https://flask.palletsprojects.com/en/latest/deploying/
- **MySQL Docs**: https://dev.mysql.com/doc/

---

## ✅ Deployment Checklist

Use this checklist to track your progress:

### Backend (Render)
- [ ] Render account created
- [ ] Repository connected
- [ ] Blueprint deployed (render.yaml)
- [ ] Environment variables configured
- [ ] Database initialized (init_db.py)
- [ ] Backend URL obtained
- [ ] Health check endpoint tested

### Frontend (Vercel)
- [ ] Vercel account created
- [ ] Repository imported
- [ ] Project deployed
- [ ] API base URL updated in api.js
- [ ] Frontend URL obtained
- [ ] CORS updated in backend
- [ ] Login tested successfully

### Final Checks
- [ ] Database connection working
- [ ] Authentication working
- [ ] CSV import working
- [ ] Schedule generation tested
- [ ] All pages accessible
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Security checklist completed

---

**🎉 Congratulations! Your CCISched application is now live!**

Share your deployment URLs:
- **Frontend**: `https://your-project.vercel.app`
- **Backend**: `https://your-project.onrender.com`
