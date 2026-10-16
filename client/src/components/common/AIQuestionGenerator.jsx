import React, { useState } from 'react';
import api from '../../api/axios';
import useToast from '../../hooks/useToast';

/**
 * AIQuestionGenerator
 *
 * Lightweight, compact AI question generator that connects to the Gemini API.
 * Keeps a minimal footprint:
 *   - Initial state: compact single-row topic input + Generate button
 *   - Generated state: sleek, lightweight editable preview + Regenerate & Add to Form buttons
 *
 * @param {Object} props
 * @param {'quiz'|'assignment'} props.context - Context for question generation
 * @param {Function} props.onAddQuestion - Callback function: (questionText) => void
 * @param {string} [props.placeholder] - Custom placeholder text
 */
const AIQuestionGenerator = ({
  context = 'quiz',
  onAddQuestion,
  placeholder = 'e.g., Generate a question about brute force algorithms',
}) => {
  const toast = useToast();
  const [prompt, setPrompt] = useState('');
  const [generatedQuestion, setGeneratedQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const trimmed = prompt.trim();
    if (!trimmed) {
      setError('Please enter a topic or prompt first.');
      return;
    }
    if (trimmed.length < 3) {
      setError('Prompt must be at least 3 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/ai/generate-question', {
        prompt: trimmed,
        context,
      });

      if (response.data && response.data.success && response.data.question) {
        setGeneratedQuestion(response.data.question);
      } else {
        throw new Error(response.data?.message || 'Failed to generate question.');
      }
    } catch (err) {
      console.error('AI question generation error:', err);
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to generate question. Please try again.';
      setError(serverMsg);
      toast.error(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    const trimmed = generatedQuestion.trim();
    if (!trimmed) {
      toast.warning('Generated question is empty.');
      return;
    }

    if (onAddQuestion) {
      onAddQuestion(trimmed);
      toast.success('Question added to form!');
      // Clear generated preview after inserting to keep the UI clean & compact
      setGeneratedQuestion('');
      setError(null);
    }
  };

  const handleDismiss = () => {
    setGeneratedQuestion('');
    setError(null);
  };

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      {/* ── Compact Input Bar ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.8rem',
            fontWeight: '600',
            color: '#3949ab',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
          title={`Generate ${context === 'assignment' ? 'assignment' : 'quiz'} question with AI`}
        >
          <span>✨</span>
          <span>AI Assist:</span>
        </span>

        <input
          type="text"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleGenerate();
            }
          }}
          placeholder={placeholder}
          disabled={loading}
          maxLength={500}
          style={{
            flex: '1 1 240px',
            padding: '0.45rem 0.7rem',
            fontSize: '0.85rem',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
        />

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          style={{
            padding: '0.45rem 0.9rem',
            backgroundColor: loading ? '#94a3b8' : '#3949ab',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.825rem',
            fontWeight: '600',
            cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            flexShrink: 0,
            transition: 'background-color 0.15s ease',
          }}
          title="Generate question using Gemini AI"
        >
          {loading ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              <span>Generating...</span>
            </>
          ) : (
            <span>Generate Question</span>
          )}
        </button>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.45rem 0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#991b1b',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: '0.2rem 0.5rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #fca5a5',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Lightweight Editable Preview (shown only after generation) ─ */}
      {generatedQuestion && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.65rem 0.75rem',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #3949ab',
            borderRadius: '6px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: '#475569',
            }}
          >
            <span>Generated Preview (editable):</span>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '0 0.25rem',
              }}
              title="Dismiss preview"
            >
              ✕ Dismiss
            </button>
          </div>

          <textarea
            value={generatedQuestion}
            onChange={(e) => setGeneratedQuestion(e.target.value)}
            disabled={loading}
            rows={2}
            style={{
              width: '100%',
              padding: '0.45rem 0.65rem',
              fontSize: '0.85rem',
              lineHeight: '1.4',
              color: '#1e293b',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '5px',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '0.4rem',
              marginTop: '0.45rem',
            }}
          >
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              style={{
                padding: '0.35rem 0.65rem',
                backgroundColor: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '5px',
                fontSize: '0.775rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
              title="Generate a different variation with the same prompt"
            >
              {loading ? '↻ Regenerating...' : '↻ Regenerate'}
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={loading || !generatedQuestion.trim()}
              style={{
                padding: '0.35rem 0.8rem',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '5px',
                fontSize: '0.775rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              title="Insert into the question text below"
            >
              ✓ Add to Form
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIQuestionGenerator;
