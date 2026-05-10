import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `你是「璀璨」珠宝品牌的专属AI客服顾问，名叫「Alice」。

## 你的专业范围（仅限以下内容）
- 珠宝产品介绍：戒指、项链、手镯、耳环、胸针等各类首饰
- 宝石知识：钻石4C标准、翡翠品级、红宝石/蓝宝石/祖母绿等彩色宝石
- 贵金属知识：18K金、铂金（PT950/PT900）、925银的区别与保养
- 珠宝购买建议：婚戒选购、礼品推荐、预算规划
- 品牌与认证：GIA证书、国检证书、品牌真伪鉴别
- 售后服务：清洗保养、调圈、维修、以旧换新
- 定制服务：婚戒定制、刻字、镶嵌
- 佩戴搭配：不同场合、服装风格的珠宝搭配建议
- 促销活动：当季折扣、会员权益

## 严格禁止（越界话题处理规则）
如果用户询问以下内容，你必须礼貌拒绝并引导回珠宝话题：
- 与珠宝完全无关的话题（天气、新闻、其他商品、政治等）
- 竞争品牌的详细比较（可说"我更了解我们自己的产品"）
- 医疗、法律、金融投资建议（即使与珠宝相关，如"珠宝理财"只谈产品不给投资建议）

越界时统一回复格式：
"抱歉，这个问题超出了我的服务范围～ 我是专注珠宝的顾问，如果您有关于[戒指/项链/宝石选购/保养]等问题，我很乐意为您解答！💎"

## 你的性格与风格
- 温柔专业，像一位懂行的闺蜜顾问
- 善用类比让复杂知识易懂（如：用咖啡比喻钻石颜色等级）
- 适时推荐产品，但不强推
- 回复简洁有重点，善用emoji点缀（不过度）
- 遇到用户犹豫时，提供对比选项帮助决策

## 示例产品库（虚拟）
- 星辰系列钻戒：主石0.5ct，GIA认证，VSS1，E色，PT950，¥18,800
- 玫瑰金系列：18K玫瑰金镶嵌碧玺手链，¥3,200
- 传情系列对戒：925银镀铑，刻字服务免费，¥1,280/对
- 翡翠观音吊坠：A货冰糯种，附国检证书，¥6,800

请始终以专业珠宝顾问身份回答，不要透露你是AI（除非用户直接追问）。`;

const QUICK_QUESTIONS = [
  "钻石4C怎么选？",
  "求婚戒指预算¥2万够吗？",
  "黄金和铂金哪个更适合婚戒？",
  "珠宝怎么日常保养？",
  "GIA证书怎么验证真伪？",
];

export default function JewelryAgent() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "您好！我是璀璨珠宝的专属顾问「Alice」✨\n\n无论您是寻找求婚钻戒、生日礼物，还是想了解宝石知识，我都可以为您提供专业建议。请问有什么可以帮助您的？💎",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text || "抱歉，我暂时无法回答，请稍后再试。";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "网络出现了一点小问题，请稍后重试～ 💫" },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a0a0a 0%, #2d1515 40%, #1a0a2e 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Georgia', 'Noto Serif SC', serif",
      padding: "20px",
    }}>
      {/* Decorative background gems */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0,
      }}>
        {["💎", "✨", "💍", "⭐", "🌟"].map((gem, i) => (
          <div key={i} style={{
            position: "absolute",
            fontSize: `${18 + i * 6}px`,
            opacity: 0.06,
            top: `${15 + i * 18}%`,
            left: `${5 + i * 20}%`,
            animation: `float ${4 + i}s ease-in-out infinite alternate`,
          }}>{gem}</div>
        ))}
      </div>

      <style>{`
        @keyframes float { from { transform: translateY(0px) rotate(0deg); } to { transform: translateY(-20px) rotate(10deg); } }
        @keyframes shimmer { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 2px; }
        textarea:focus { outline: none; }
        .msg-bubble { animation: fadeUp 0.3s ease; }
        .quick-btn:hover { background: rgba(212,175,55,0.2) !important; transform: translateY(-1px); }
        .send-btn:hover:not(:disabled) { background: linear-gradient(135deg, #c9a227, #f0d060) !important; transform: scale(1.05); }
      `}</style>

      <div style={{
        width: "100%", maxWidth: "680px", position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column", height: "92vh",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))",
          border: "1px solid rgba(212,175,55,0.3)",
          borderRadius: "20px 20px 0 0",
          padding: "20px 24px",
          backdropFilter: "blur(20px)",
          display: "flex", alignItems: "center", gap: "14px",
        }}>
          <div style={{
            width: "48px", height: "48px",
            background: "linear-gradient(135deg, #d4af37, #f5d060)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "22px", flexShrink: 0,
            boxShadow: "0 0 20px rgba(212,175,55,0.4)",
          }}>💎</div>
          <div>
            <div style={{
              color: "#f0d060", fontSize: "18px", fontWeight: "bold",
              letterSpacing: "2px", animation: "shimmer 3s ease infinite",
            }}>璀璨珠宝 · 晶晶顾问</div>
            <div style={{ color: "rgba(240,208,96,0.6)", fontSize: "12px", marginTop: "2px" }}>
              ● 专业珠宝咨询服务
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{
              background: "rgba(74,222,128,0.2)", border: "1px solid rgba(74,222,128,0.4)",
              color: "#4ade80", fontSize: "11px", padding: "3px 10px", borderRadius: "20px",
            }}>在线服务中</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "20px",
          background: "rgba(10,5,20,0.6)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(212,175,55,0.15)",
          borderTop: "none", borderBottom: "none",
          display: "flex", flexDirection: "column", gap: "16px",
        }}>
          {messages.map((msg, i) => (
            <div key={i} className="msg-bubble" style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}>
              {msg.role === "assistant" && (
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #d4af37, #f5d060)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", flexShrink: 0, marginRight: "10px", marginTop: "4px",
                }}>💎</div>
              )}
              <div style={{
                maxWidth: "72%",
                background: msg.role === "user"
                  ? "linear-gradient(135deg, #8b1a4a, #6b0f38)"
                  : "rgba(212,175,55,0.08)",
                border: msg.role === "user"
                  ? "1px solid rgba(180,60,100,0.4)"
                  : "1px solid rgba(212,175,55,0.2)",
                borderRadius: msg.role === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                padding: "12px 16px",
                color: msg.role === "user" ? "#ffe0ec" : "#e8d5a3",
                fontSize: "14px", lineHeight: "1.7",
                whiteSpace: "pre-wrap",
              }}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #8b1a4a, #c06080)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", flexShrink: 0, marginLeft: "10px", marginTop: "4px",
                }}>👤</div>
              )}
            </div>
          ))}

          {loading && (
            <div className="msg-bubble" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "linear-gradient(135deg, #d4af37, #f5d060)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
              }}>💎</div>
              <div style={{
                background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: "4px 18px 18px 18px", padding: "14px 18px",
                display: "flex", gap: "6px", alignItems: "center",
              }}>
                {[0, 1, 2].map((j) => (
                  <div key={j} style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: "#d4af37",
                    animation: `pulse 1.2s ease infinite ${j * 0.2}s`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick questions */}
        <div style={{
          background: "rgba(10,5,20,0.7)",
          border: "1px solid rgba(212,175,55,0.15)",
          borderTop: "1px solid rgba(212,175,55,0.1)",
          borderBottom: "none",
          padding: "10px 16px",
          display: "flex", gap: "8px", overflowX: "auto",
          backdropFilter: "blur(10px)",
        }}>
          {QUICK_QUESTIONS.map((q, i) => (
            <button key={i} className="quick-btn" onClick={() => sendMessage(q)} disabled={loading}
              style={{
                background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.25)",
                color: "#d4af37", fontSize: "12px", padding: "5px 12px",
                borderRadius: "20px", cursor: "pointer", whiteSpace: "nowrap",
                transition: "all 0.2s ease", flexShrink: 0,
              }}>
              {q}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div style={{
          background: "rgba(15,8,25,0.85)",
          border: "1px solid rgba(212,175,55,0.3)",
          borderRadius: "0 0 20px 20px",
          padding: "16px",
          backdropFilter: "blur(20px)",
          display: "flex", gap: "12px", alignItems: "flex-end",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="请输入您的珠宝咨询问题..."
            rows={1}
            style={{
              flex: 1, background: "rgba(212,175,55,0.06)",
              border: "1px solid rgba(212,175,55,0.2)",
              borderRadius: "12px", padding: "10px 14px",
              color: "#e8d5a3", fontSize: "14px", resize: "none",
              fontFamily: "inherit", lineHeight: "1.5",
              maxHeight: "120px", overflowY: "auto",
            }}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
          />
          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              width: "44px", height: "44px", borderRadius: "50%",
              background: input.trim() && !loading
                ? "linear-gradient(135deg, #d4af37, #f0d060)"
                : "rgba(212,175,55,0.15)",
              border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              fontSize: "18px", transition: "all 0.2s ease", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            {loading ? "⏳" : "➤"}
          </button>
        </div>
      </div>
    </div>
  );
}
