import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Serve static files from dist in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
}

// Simple in-memory database (for demo purposes)
let diamonds = [
  { id: 1, carat: 1.5, color: 'D', clarity: 'IF', price: 15000, created_at: new Date().toISOString() },
  { id: 2, carat: 0.8, color: 'F', clarity: 'VVS1', price: 5000, created_at: new Date().toISOString() },
  { id: 3, carat: 2.0, color: 'E', clarity: 'VVS2', price: 25000, created_at: new Date().toISOString() },
  { id: 4, carat: 1.2, color: 'G', clarity: 'VS1', price: 8000, created_at: new Date().toISOString() }
]

let nextId = 5

// Initialize database (for file-based persistence)
const initDatabase = () => {
  const dbPath = path.join(__dirname, 'db', 'diamonds.json')
  
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf8')
      diamonds = JSON.parse(data)
      nextId = Math.max(...diamonds.map(d => d.id), 0) + 1
      console.log('Loaded diamonds from file:', diamonds.length)
    } else {
      // Save initial data
      saveDatabase()
      console.log('Created new database with sample data')
    }
  } catch (error) {
    console.log('Using in-memory database:', error.message)
  }
  
  console.log('Database initialized successfully')
}

// Save database to file
const saveDatabase = () => {
  try {
    const dbPath = path.join(__dirname, 'db', 'diamonds.json')
    fs.writeFileSync(dbPath, JSON.stringify(diamonds, null, 2))
  } catch (error) {
    console.log('Could not save database to file:', error.message)
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Database is connected',
    diamondsCount: diamonds.length,
    timestamp: new Date().toISOString(),
    storage: 'in-memory (JSON file persistence)'
  })
})

app.get('/api/diamonds', (req, res) => {
  res.json(diamonds)
})

app.post('/api/diamonds', (req, res) => {
  const { carat, color, clarity, price } = req.body
  
  if (!carat || !color || !clarity || !price) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  
  const newDiamond = {
    id: nextId++,
    carat: parseFloat(carat),
    color,
    clarity,
    price: parseInt(price),
    created_at: new Date().toISOString()
  }
  
  diamonds.unshift(newDiamond) // Add to beginning
  saveDatabase()
  
  res.json({
    ...newDiamond,
    message: 'Diamond added successfully'
  })
})

// Delete a diamond
app.delete('/api/diamonds/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const initialLength = diamonds.length
  
  diamonds = diamonds.filter(d => d.id !== id)
  
  if (diamonds.length < initialLength) {
    saveDatabase()
    res.json({ message: 'Diamond deleted successfully' })
  } else {
    res.status(404).json({ error: 'Diamond not found' })
  }
})

app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working!',
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    storage: 'in-memory with JSON file backup'
  })
})

// Serve index.html for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

// Initialize database and start server
initDatabase()

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Database: in-memory with JSON file persistence`)
  console.log(`Data file: ${path.join(__dirname, 'db', 'diamonds.json')}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Total diamonds: ${diamonds.length}`)
})