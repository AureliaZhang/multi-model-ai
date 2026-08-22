import { describe, it, expect } from 'vitest';
import { buildSelfReviewPrompt, extractReviewedContent } from './selfReview';

/**
 * 自审段（v0.7.99，§10.11 ② C 段）
 *
 * 自审的返回值会**整条替换**用户已经看到的回答，所以「什么算拿到了有效结果」
 * 这个判断很要紧 —— 判松了会把答案抹成空白。原先这段逻辑内联在
 * routes/chat.ts 的处理函数里，零测试。
 */

describe('buildSelfReviewPrompt', () => {
  it('把待校对的正文夹在起止标记之间', () => {
    const p = buildSelfReviewPrompt('这是一段回答');
    expect(p).toContain('---BEGIN AI RESPONSE---\n这是一段回答\n---END AI RESPONSE---');
  });

  it('明确要求只返回正文、不要加说明 —— 否则模型的客套话会进最终答案', () => {
    const p = buildSelfReviewPrompt('x');
    expect(p).toContain('return ONLY the corrected version');
    expect(p).toContain('Do NOT add any commentary');
  });

  it('原样保留正文里的换行与 markdown（表格正是要校对的对象）', () => {
    const body = '| a | b |\n|---|---|\n| 1 | 2 |';
    expect(buildSelfReviewPrompt(body)).toContain(body);
  });

  it('空正文也能拼出结构完整的提示词（不抛异常）', () => {
    const p = buildSelfReviewPrompt('');
    expect(p).toContain('---BEGIN AI RESPONSE---');
    expect(p).toContain('---END AI RESPONSE---');
  });
});

describe('extractReviewedContent', () => {
  const wrap = (content: unknown) => ({ choices: [{ message: { content } }] });

  it('正常取出修订后的正文', () => {
    expect(extractReviewedContent(wrap('修订后的内容'))).toBe('修订后的内容');
  });

  it('⚠ 只有空白的结果算失败 —— 否则会把用户看到的答案抹成空白', () => {
    expect(extractReviewedContent(wrap(''))).toBeNull();
    expect(extractReviewedContent(wrap('   '))).toBeNull();
    expect(extractReviewedContent(wrap('\n\t  \n'))).toBeNull();
  });

  it('返回未 trim 的原文 —— 只用 trim 判空，不改内容（缩进和换行是有意义的）', () => {
    expect(extractReviewedContent(wrap('  有内容  \n'))).toBe('  有内容  \n');
  });

  it('响应结构缺胳膊少腿时返回 null 而不是抛异常', () => {
    expect(extractReviewedContent(null)).toBeNull();
    expect(extractReviewedContent(undefined)).toBeNull();
    expect(extractReviewedContent({})).toBeNull();
    expect(extractReviewedContent({ choices: [] })).toBeNull();
    expect(extractReviewedContent({ choices: [{}] })).toBeNull();
    expect(extractReviewedContent({ choices: [{ message: {} }] })).toBeNull();
  });

  it('content 不是字符串时也算失败（有的站会回 null 或数组形式）', () => {
    expect(extractReviewedContent(wrap(null))).toBeNull();
    expect(extractReviewedContent(wrap(123))).toBeNull();
    expect(extractReviewedContent(wrap([{ type: 'text', text: 'x' }]))).toBeNull();
  });

  it('只看第一个 choice', () => {
    const multi = { choices: [{ message: { content: '第一个' } }, { message: { content: '第二个' } }] };
    expect(extractReviewedContent(multi)).toBe('第一个');
  });
});
