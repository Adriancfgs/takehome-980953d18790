
const express = require("express");
const path = require("node:path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/messages", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Falta el mensaje del huésped" });
  }

  try {
    const aiResponse = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.LLM_API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "WorkFactory-Technical-Test/1.0",
        "X-Test-Scenario": process.env.LLM_SCENARIO || "normal"
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "wf-late-checkout-mock-v1",
        messages: [{ role: "user", content: text }]
      })
    });

    const data = await aiResponse.json();

    const interpretation = JSON.parse(data.choices[0].message.content);

    res.json({ success: true, interpretation });
  } catch (error) {
    console.error("Error al contactar con la IA:", error);
    res.status(500).json({ error: "Fallo de comunicación interno" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
