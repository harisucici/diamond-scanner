export const chatService = {
  async sendMessage(messages, userMessage) {
    try {
      const updatedMessages = [...messages, { role: "user", content: userMessage }];
      
      const response = await fetch('/api/chat', {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: updatedMessages
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API请求失败: ${response.status}`);
      }

      const data = await response.json();
      const reply = data.reply || "抱歉，我暂时无法回答，请稍后再试。";
      
      return [...updatedMessages, { role: "assistant", content: reply }];
    } catch (err) {
      console.error('Chat Service Error:', err);
      return [...messages, { role: "user", content: userMessage }, { 
        role: "assistant", 
        content: "网络出现了一点小问题，请稍后重试～ 💫" 
      }];
    }
  }
};

export default chatService;