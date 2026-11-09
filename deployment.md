# Fitness Extreme International — Deployment Guide

This guide covers running and deploying the Bengaluru (Varthur) gym landing page.
The application uses Node.js and Express, serves the site from `public/`, stores
enquiries in MySQL, and includes an EJS-based admin area.

## How the application works

- `GET /` serves the landing page from `public/index.html`.
- `POST /api/submit` saves enquiries to the MySQL `leads` table.
- `/admin` opens the admin login and leads dashboard.
- Gym photos and other static files are in `public/img/`.

There is no frontend build step. Run the Express server to serve the site.

## Requirements

- Node.js 18 or newer and npm
- MySQL
- A Linux server and a process manager such as PM2 for production
- A domain and HTTPS certificate if the site will be public

## 1. Get the project and install dependencies

On the server, clone or upload this project, then run:

```bash
cd gym_bengluru
npm ci --omit=dev
```

Keep `.env` and `node_modules/` out of source control and do not upload
development `.env` values to production.

## 2. Configure environment variables

Create a `.env` file in the project root and set the values for your server:

```dotenv
PORT=2000
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=emirates_first
SESSION_SECRET=replace_with_a_long_random_secret
ADMIN_USERNAME=choose_an_admin_username
ADMIN_PASSWORD=choose_a_strong_admin_password
```

Use the database name `emirates_first`; it is the name created by the included
schema. Use a long, unique session secret and a strong admin password. Keep this
file private.

## 3. Create the database

The schema creates the `emirates_first` database and `leads` table:

```bash
mysql -u root -p < database/schema.sql
```

When using a restricted MySQL account, make sure it has permission to create or
access the database and to read and write the `leads` table.

## 4. Start and check the application

Start the server:

```bash
node server.js
```

The default port is `2000`; set `PORT` in `.env` if needed. Check the home page
at `http://SERVER_ADDRESS:2000/`. Confirm that the enquiry form saves a lead and
that `/admin` displays the login page.

## 5. Keep the application running with PM2

On a Linux server, install PM2 and start the application from the project folder:

```bash
sudo npm install --global pm2
pm2 start server.js --name fitness-extreme
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup` to enable startup after a server reboot.
Useful checks:

```bash
pm2 status
pm2 logs fitness-extreme
```

After uploading code changes, install dependencies if the lock file changed,
then restart the app:

```bash
npm ci --omit=dev
pm2 restart fitness-extreme
```

## 6. Connect a domain with Nginx (recommended)

Point the domain's DNS A record to the server's IP address. Configure Nginx to
forward web traffic to the Node.js port. For example, replace
`gym.example.com` with your domain:

```nginx
server {
    listen 80;
    server_name gym.example.com www.gym.example.com;

    location / {
        proxy_pass http://127.0.0.1:2000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Test and reload Nginx using your server's normal service commands. Then enable
HTTPS with your hosting provider or a certificate manager such as Certbot.
Serve the public site over HTTPS.

## Deployment checklist

- [ ] Production `.env` values are set and kept private.
- [ ] MySQL is running and `emirates_first.leads` exists.
- [ ] The landing page loads from the domain.
- [ ] A test enquiry is saved and visible in `/admin`.
- [ ] Admin credentials are unique and strong.
- [ ] HTTPS works for the public site.
- [ ] PM2 reports the app online and starts it after a reboot.
