const express = require("express")
const makeWASocket = require("@whiskeysockets/baileys").default
const { useMultiFileAuthState } = require("@whiskeysockets/baileys")
const path = require('path')
const qrcode = require("qrcode-terminal")

const app = express()
app.use(express.json())

const messagesReceived = []


app.use(express.static(path.join(__dirname)))
let sock = null

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session")

  
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  })

  sock.ev.on("connection.update", ({ qr, connection , lastDisconnect}) => {
    if (qr) {
      qrcode.generate(qr, { small: true })
      console.log("📲 Escaneie o QR code acima")
    }
    if (connection === "open") {
      console.log("✅ Bot conectado ao WhatsApp!")
    }if (connection === "close") {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== 401
        console.log("❌ Conexão fechada, reconectando?", shouldReconnect)
        if (shouldReconnect) {
            startBot() // Reinicia a conexão
        } else {
                console.log("❌ Falha de autenticação, revalide seu QR code")
        }}
  }
)

  sock.ev.on("messages.upsert", async (msg) => {
    const message = msg.messages[0]
    if (!message.message || message.key.fromMe) return

    const from = message.key.remoteJid
    const text = message.message.conversation || message.message.extendedTextMessage?.text
    console.log(`📩 Mensagem recebida de ${from}: ${text}`)
    messagesReceived.push({ from, text, timestamp: Date.now() })

    // Resposta automática simples
    if (text && text.toLowerCase().includes("oi")) {
      await sock.sendMessage(from, { text: "Olá! 👋 Como posso ajudar?" })
    }
  })

  sock.ev.on("creds.update", saveCreds)
}

startBot()

// Rota simples para testar o bot está online
app.get("/", (req, res) => {
  if (sock) {
    res.json({ status: "Bot está online" })
  } else {
    res.json({ status: "Bot não conectado" })
  }
})

app.get("/messages", (req, res) => {
  res.json(messagesReceived)
})


// Rota para enviar mensagem via API
app.post("/send-message", async (req, res) => {
  const { to, message } = req.body

  if (!to || !message) {
    return res.status(400).json({ error: "Campos 'to' e 'message' são obrigatórios" })
  }

  try {
    await sock.sendMessage(to, { text: message })
    res.json({ status: "Mensagem enviada" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Erro ao enviar mensagem" })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`)
})
