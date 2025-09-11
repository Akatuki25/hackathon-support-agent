'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getProject } from '@/libs/modelAPI/project';
import { getProjectDocument, patchProjectDocument  } from '@/libs/modelAPI/document';
import { getQAsByProjectId, postQA } from '@/libs/modelAPI/qa';
import { evaluateMvpFromSummary } from '@/libs/service/summary';
import { EvaluationResultType, ProjectType, ProjectDocumentType, QAType, SummaryQaItem, EvaluationResultAskUser } from '@/types/modelTypes';
import PageLoading from '@/components/PageLoading';
import { use } from 'chai';

// Helper component for the right panel
interface QAPanelProps {
  questions: string[];
  onSave: (newQAs: { question: string; answer: string }[]) => void;
  isSaving: boolean;
  evaluationCount: number;
  projectId: string;
}




const QAPanel = ({ questions, onSave, isSaving, evaluationCount, projectId }: QAPanelProps) => {
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [loaded, setLoaded] = useState(false);


  useEffect(() => {
    // summaryのAPIを使って質問を取得
    if (questions.length > 0 && !loaded) {
        const initialAnswers: { [key: number]: string } = {};
        questions.forEach((q, i) => {
            initialAnswers[i] = '';
        });
        setAnswers(initialAnswers);
        setLoaded(true);
        }
        
  }, [questions]);




  const handleAnswerChange = (index: number, value: string) => {
    setAnswers(prev => ({ ...prev, [index]: value }));
  };

  const handleSave = () => {
    const newQAs = questions.map((q, i) => ({
      question: q,
      answer: answers[i] || '',
    }));
    onSave(newQAs);
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border-l h-full bg-gray-50 dark:bg-gray-900">
      <h2 className="text-xl font-bold mb-4">Follow-up Questions</h2>
      <div className="flex-grow overflow-y-auto space-y-4 pr-2">
        {questions.map((q, i) => (
          <div key={i}>
            <label className="block font-semibold mb-1 text-sm">{q}</label>
            <textarea
              className="w-full p-2 border rounded bg-white dark:bg-gray-800"
              rows={3}
              value={answers[i] || ''}
              onChange={(e) => handleAnswerChange(i, e.target.value)}
              placeholder="Your answer..."
            />
          </div>
        ))}
      </div>
      <div className="flex-shrink-0 pt-4">
        {evaluationCount >= 3 ? (
          <button 
            onClick={() => { /* Navigate to next step */ alert('Proceeding to Functional Requirements Definition...'); }}
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700"
          >
            Save and Proceed to Functional Requirements
          </button>
        ) : (
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {isSaving ? 'Saving...' : 'Save Answers & Re-evaluate'}
          </button>
        )}
      </div>
    </div>
  );
};


export default function SummaryQAPage() {
  const params = useParams();
  const projectId = params.ProjectId as string;

  const [project, setProject] = useState<ProjectType | null>(null);
  const [document, setDocument] = useState<ProjectDocumentType | null>(null);
  const [specification, setSpecification] = useState('');
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResultType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [evaluationCount, setEvaluationCount] = useState(0);

  const runEvaluation = async (spec: string, existingQAs: QAType[], proj: ProjectType) => {
    if (!proj) return;
    
    const qaListForEval: SummaryQaItem[] = existingQAs.map(qa => ({
        Question: qa.question,
        Answer: qa.answer || '',
    }));

    try {
      // Use project idea and existing QAs for evaluation
      const result = await evaluateMvpFromSummary(proj.idea);
      setEvaluationResult(result);
      setEvaluationCount(prev => prev + 1);
    } catch (error) {
      console.error("Evaluation failed:", error);
      alert("Failed to run evaluation. The backend endpoint might not be implemented yet. Please check the console for details.");
    }
  };

  useEffect(() => {
    if (!projectId) return;

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [proj, doc, qas] = await Promise.all([
          getProject(projectId),
          getProjectDocument(projectId),
          getQAsByProjectId(projectId),
        ]);

        setProject(proj);
        setDocument(doc);
        const initialSpec = doc?.specification || proj?.idea || '';
        setSpecification(initialSpec);
        
        await runEvaluation(initialSpec, qas, proj);

      } catch (error) {
        console.error("Failed to fetch initial data:", error);
        alert("Failed to load page data. Please check the console and try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [projectId]);

  const handleReEvaluate = async (newAnswers: { question: string; answer: string }[]) => {
    if (!project) return;
    setIsSaving(true);

    try {
      // 1. Save new QAs
      const newQAPromises = newAnswers
        .filter(item => item.answer.trim() !== '') // Only save answered questions
        .map(item => 
          postQA({
            project_id: projectId,
            question: item.question,
            answer: item.answer,
            is_ai: true, // Questions came from AI
            importance: 1, // Default importance
          })
      );
      await Promise.all(newQAPromises);

      // 2. Update the specification in the document if it exists and changed
      if (document && specification !== document.specification) {
          await patchProjectDocument(document.doc_id!, { specification: specification });
      }

      // 3. Get all QAs again
      const allQAs = await getQAsByProjectId(projectId);

      // 4. Re-run evaluation
      await runEvaluation(specification, allQAs, project);

    } catch (error) {
      console.error("Failed to re-evaluate:", error);
      alert("An error occurred during re-evaluation. Please check the console.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && evaluationCount === 0) {
    return <PageLoading />;
  }

  if (!project) {
      return <div className="p-4 text-red-500">Failed to load project data. Please try again.</div>
  }

  const questionsToAsk =
    evaluationResult?.action === 'ask_user'
      ? (evaluationResult as EvaluationResultAskUser).sectional_qa.flatMap(s => s.questions)
      : [];

  return (
    <div className="grid md:grid-cols-2 h-screen bg-white dark:bg-black text-black dark:text-white">
      {/* Left Panel: Specification Editor */}
      <div className="flex flex-col p-4">
        <h2 className="text-xl font-bold mb-4">Specification</h2>
        <textarea
          className="w-full flex-grow p-2 border rounded font-mono text-sm bg-gray-100 dark:bg-gray-800"
          value={specification}
          onChange={(e) => setSpecification(e.target.value)}
        />
        {evaluationResult?.action === 'proceed' && (
             <div className="pt-4">
                <button onClick={async () => {
                    if (!document) return;
                    setIsSaving(true);
                    await patchProjectDocument(document.doc_id!, { specification: specification });
                    setIsSaving(false);
                    alert("Specification Saved!");
                }} disabled={isSaving}
                className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {isSaving ? 'Saving...' : 'Save Specification'}
                </button>
             </div>
        )}
      </div>

      {/* Right Panel: Questions or Success Message */}
      {evaluationResult?.action === 'ask_user' ? (
        <QAPanel
          questions={questionsToAsk}
          onSave={handleReEvaluate}
          isSaving={isSaving}
          evaluationCount={evaluationCount}
          projectId={projectId}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-4 border-l bg-gray-50 dark:bg-gray-900">
          <h2 className="text-2xl font-bold text-green-500">Evaluation Passed!</h2>
          <p className="mt-2 text-center">The current specification seems feasible.</p>
          <p className="mt-1 text-center text-sm text-gray-500">You can continue to refine the specification on the left and save your changes.</p>
        </div>
      )}
    </div>
  );
}
