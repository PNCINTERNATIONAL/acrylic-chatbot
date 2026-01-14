import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());
app.use(express.static("."));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "메시지가 없습니다." });
  }

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `여기에 지금 쓰고 있는 system 프롬프트 전체`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const text =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "";

    res.json({ reply: text });
  } catch (e) {
    res.status(500).json({ error: "OpenAI 오류" });
  }
});

app.listen(3000);
