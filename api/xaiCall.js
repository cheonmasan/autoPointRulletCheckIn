const axios = require("axios");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
let XAI_API_TOKEN = process.env.XAI_API_TOKEN; // 환경변수에서 API 키 가져오기

if (!XAI_API_TOKEN) {
  throw new Error("XAI_API_TOKEN is not defined. Please check your environment variables.");
}

async function xaiCall(prompt) {
  try {
    const response = await axios.post(
      "https://api.x.ai/v1/chat/completions",
      {
        model: "grok-3-latest", // Grok 모델 사용
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200, // 필요에 따라 조정
        temperature: 0.7, // 적절한 창의성 설정
        top_p: 0.9, // 확률 분포 기반 샘플링
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${XAI_API_TOKEN}`,
        },
      }
    );

    // 응답 데이터 반환
    return response.data.choices[0].message.content;
  } catch (error) {
    // 에러 처리
    throw new Error(
      `Error: ${error.response?.status || "Unknown"} - ${
        error.response?.statusText || "No status text"
      } - ${error.response?.data || error.message}`
    );
  }
}

module.exports = { xaiCall };