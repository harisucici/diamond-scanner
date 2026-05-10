import { SYSTEM_PROMPT, API_CONFIG } from '../config/chat.js';

export const chatService = {
  async sendMessage(messages, userMessage) {
    try {
      // 添加用户消息到消息列表
      const updatedMessages = [...messages, { role: "user", content: userMessage }];
      
      // 准备API消息格式
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

      const response = await fetch(API_CONFIG.url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY || ""}`
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          max_tokens: API_CONFIG.maxTokens,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...apiMessages
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || "抱歉，我暂时无法回答，请稍后再试。";
      
      // 返回更新后的消息列表，包括助手的回复
      return [...updatedMessages, { role: "assistant", content: reply }];
    } catch (err) {
      console.error('Chat Service Error:', err);
      // 返回包含错误消息的消息列表
      return [...messages, { role: "user", content: userMessage }, { 
        role: "assistant", 
        content: "网络出现了一点小问题，请稍后重试～ 💫" 
      }];
    }
  }
};

export default chatService;