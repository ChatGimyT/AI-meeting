/* بوستات سوشيال ميديا على DeepSeek — البوستات قصيرة فلا حاجة للتجزئة. */
export default {
  id: 'social_posts_deepseek',
  label: 'سوشيال ميديا — حزمة بوستات (DeepSeek)',
  extends: 'social_posts_ar',
  llm: {
    provider: 'deepseek',
    url: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    chair_model: 'deepseek-chat',
    max_tokens: 8192,
    max_output_tokens: 8192,
    temperature: 0.5,
    temperature_scale: 2.4,
    max_temperature: 1.5,
    json_mode: true,
    enable_tools: false,
    chunked_writing: false
  },
  gate: { max_rounds: 4, max_restarts: 1 }
};
