"use client";
import Header from '@/components/Session/Header';

export default function TaskPage({ params }: { params: { taskId: string } }) {
    const { taskId } = params;
    return (
        <div className="h-screen w-screen bg-gray-900 text-white">
            <Header />
            <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">Task Detail</h1>
                <p>Task ID: {taskId}</p>
                {/* Fetch and display more task details here */}
            </div>
        </div>
    );
}

// Note: The TaskFlow component and related logic have been omitted for brevity.
// You can integrate the TaskFlow component here if needed, passing the taskId as a prop.
