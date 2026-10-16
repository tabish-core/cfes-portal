/**
 * aiQuestion.test.js — Unit and integration tests for AI Question Generation.
 *
 * Tests:
 *  - aiQuestionService input constraints, API key validation, response cleaning, and error handling
 *  - aiQuestionController request validation (prompt length, context type)
 *  - Protection against empty responses and safety violations
 */

const aiQuestionService = require('../services/aiQuestionService');
const aiQuestionController = require('../controllers/aiQuestionController');

// Mock GoogleGenerativeAI
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('AI Question Generation Service (aiQuestionService)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws an error if GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      aiQuestionService.generateQuestion({ prompt: 'Explain Dijkstra algorithm', context: 'quiz' })
    ).rejects.toMatchObject({
      message: expect.stringContaining('Gemini API key is not configured'),
      statusCode: 500,
    });
  });

  it('successfully generates and cleans a single question for quiz', async () => {
    process.env.GEMINI_API_KEY = 'test_api_key';

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => 'What is the time complexity of the brute force string search algorithm in the worst case?',
      },
    });

    const question = await aiQuestionService.generateQuestion({
      prompt: 'brute force string search algorithm',
      context: 'quiz',
    });

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: expect.stringContaining('quiz question'),
        generationConfig: expect.objectContaining({ maxOutputTokens: 1200 }),
      })
    );

    expect(question).toBe(
      'What is the time complexity of the brute force string search algorithm in the worst case?'
    );
  });

  it('successfully generates and cleans a question for assignment', async () => {
    process.env.GEMINI_API_KEY = 'test_api_key';

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => 'Design and implement a brute force approach to find all subsets of a given set.',
      },
    });

    const question = await aiQuestionService.generateQuestion({
      prompt: 'subsets problem',
      context: 'assignment',
    });

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: expect.stringContaining('course assignment task'),
      })
    );

    expect(question).toBe(
      'Design and implement a brute force approach to find all subsets of a given set.'
    );
  });

  it('cleans markdown code blocks, prefixes, and conversational filler from AI response', async () => {
    process.env.GEMINI_API_KEY = 'test_api_key';

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => 'Here is your question:\nQuestion 1: Explain the difference between DFS and BFS.',
      },
    });

    const question = await aiQuestionService.generateQuestion({
      prompt: 'DFS vs BFS',
      context: 'quiz',
    });

    expect(question).toBe('Explain the difference between DFS and BFS.');
  });

  it('handles rate limits (429 / RESOURCE_EXHAUSTED) gracefully', async () => {
    process.env.GEMINI_API_KEY = 'test_api_key';

    mockGenerateContent.mockRejectedValueOnce(
      new Error('429 RESOURCE_EXHAUSTED: Rate limit reached')
    );

    await expect(
      aiQuestionService.generateQuestion({ prompt: 'recursion', context: 'quiz' })
    ).rejects.toMatchObject({
      message: expect.stringContaining('rate limit or quota exceeded'),
      statusCode: 429,
    });
  });

  it('handles safety filter blocks gracefully', async () => {
    process.env.GEMINI_API_KEY = 'test_api_key';

    mockGenerateContent.mockRejectedValueOnce(
      new Error('Candidate was blocked due to SAFETY')
    );

    await expect(
      aiQuestionService.generateQuestion({ prompt: 'unsafe prompt', context: 'quiz' })
    ).rejects.toMatchObject({
      message: expect.stringContaining('safety filters'),
      statusCode: 400,
    });
  });
});

describe('AI Question Generation Controller (aiQuestionController)', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('returns 400 if prompt is missing or empty', async () => {
    mockReq = { body: { context: 'quiz' } };
    await aiQuestionController.generateQuestion(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('Prompt is required') })
    );
  });

  it('returns 400 if prompt is shorter than 3 characters', async () => {
    mockReq = { body: { prompt: 'hi', context: 'quiz' } };
    await aiQuestionController.generateQuestion(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('at least 3 characters') })
    );
  });

  it('returns 400 if prompt exceeds 500 characters', async () => {
    mockReq = { body: { prompt: 'a'.repeat(501), context: 'quiz' } };
    await aiQuestionController.generateQuestion(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('maximum allowed length of 500') })
    );
  });

  it('returns 400 if context is missing or invalid', async () => {
    mockReq = { body: { prompt: 'valid prompt', context: 'midterm' } };
    await aiQuestionController.generateQuestion(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining("Context must be either 'quiz' or 'assignment'") })
    );
  });

  it('returns 200 with generated question for valid request', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    mockReq = { body: { prompt: 'binary search trees', context: 'quiz' } };

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => 'What is the worst-case search time complexity in an unbalanced binary search tree?',
      },
    });

    await aiQuestionController.generateQuestion(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      question: 'What is the worst-case search time complexity in an unbalanced binary search tree?',
    });
  });
});
