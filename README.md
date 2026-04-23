# 💎 Diamond Scanner

A Vue.js web application for managing diamond information with JSON database backend.

## 🚀 Features

- **Vue.js 3** frontend with Composition API
- **Express.js** backend API
- **JSON file database** (no SQLite compilation required)
- **Responsive design** for desktop and mobile
- **Ready for deployment** to Render.com
- **Full CRUD operations** for diamond data
- **Real-time database status** display
- **API connection testing**

## 📸 Screenshot

![Diamond Scanner Interface](https://via.placeholder.com/800x450/667eea/ffffff?text=Diamond+Scanner+Vue.js+App)

## 🏗️ Project Structure

```
diamond-scanner/
├── src/                    # Vue.js source files
│   ├── App.vue            # Main Vue component
│   └── main.js            # Vue entry point
├── db/                    # JSON database files
├── server.js             # Express.js backend server
├── package.json          # Dependencies and scripts
├── vite.config.js        # Vite configuration
├── render.yaml           # Render deployment config
├── start-local.sh        # Local startup script
└── README.md             # This file
```

## 🚀 Quick Start

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd diamond-scanner

# Install dependencies
npm install

# Start backend server (port 3000)
node server.js

# In another terminal, start frontend dev server (port 5173)
npm run dev
```

### Using Startup Script
```bash
chmod +x start-local.sh
./start-local.sh
```

## 🌐 Access URLs

- **Frontend Application**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **API Test**: http://localhost:3000/api/test

## 📡 API Endpoints

### GET `/api/health`
Health check and database status.

**Response:**
```json
{
  "status": "success",
  "message": "Database is connected",
  "diamondsCount": 4,
  "timestamp": "2026-04-23T07:41:52.714Z",
  "storage": "in-memory (JSON file persistence)"
}
```

### GET `/api/diamonds`
Get all diamond records.

### POST `/api/diamonds`
Add a new diamond record.

**Request Body:**
```json
{
  "carat": 1.5,
  "color": "D",
  "clarity": "IF",
  "price": 15000
}
```

### DELETE `/api/diamonds/:id`
Delete a diamond record.

### GET `/api/test`
Test API connection.

## 💻 Frontend Features

### 1. Welcome Screen
- Modern gradient design
- Hello World message
- Project description

### 2. Database Controls
- **Check Database**: Verify connection and status
- **Add Random Diamond**: Add random sample data
- **View All Data**: Display all records in table
- **Clear All Data**: Remove all records (with confirmation)
- **Test API Connection**: Verify backend connectivity

### 3. Data Display
- Responsive table with all diamond records
- Columns: ID, Carat, Color, Clarity, Price
- Real-time updates when data changes

## 🛠️ Technology Stack

- **Frontend**: Vue.js 3 + Vite + Composition API
- **Backend**: Express.js + CORS
- **Database**: In-memory with JSON file persistence
- **Styling**: Pure CSS with responsive design
- **Build Tool**: Vite
- **Deployment**: Render.com compatible

## 🚢 Deployment to Render.com

### Automatic Deployment (recommended)
1. Push this repository to GitHub/GitLab
2. Render automatically detects `render.yaml`
3. Creates web service with proper configuration

### Manual Deployment
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your Git repository
4. Configure:
   - **Name**: diamond-scanner
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `NODE_ENV=production`
     - `PORT=3000`

## 📁 File Details

### `render.yaml` - Render Deployment Config
```yaml
services:
  - type: web
    name: diamond-scanner
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
```

### Database Schema
Data is stored in `db/diamonds.json` with the following structure:
```json
[
  {
    "id": 1,
    "carat": 1.5,
    "color": "D",
    "clarity": "IF",
    "price": 15000,
    "created_at": "2026-04-23T07:39:56.854Z"
  }
]
```

## 🔧 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   lsof -i :5173
   lsof -i :3000
   ```

2. **Node modules not installed**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **API 404 errors in production**
   - Ensure `NODE_ENV=production` is set
   - Check `render.yaml` configuration
   - Verify all API routes are defined in `server.js`

### Development Tips
- Frontend proxies API requests to `localhost:3000` in development
- Database automatically creates sample data on first run
- JSON database file persists between server restarts
- Use `start-local.sh` for easy local testing

## 📄 License

MIT

## 👥 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 🙏 Acknowledgments

- Built with Vue.js and Express.js
- Deploy-ready for Render.com
- Zero SQLite compilation required
- Perfect for learning full-stack Vue.js development

---

**Happy Diamond Scanning!** 💎