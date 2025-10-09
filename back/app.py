from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# APIルーターのインポート
from routers.project import member , project , project_document, env, task_assignment,project_qa,project_member, ai_document as project_ai_document, task
from routers import qanda, summary,  framework, directory, environment,  taskDetail, taskChat, graphTask, durationTask, deploy, function_requirements, function_structuring, technology, task_generation, task_quality, complete_task_generation, ai_document, task_dependency

app = FastAPI(
    title="LangChain Server",
    version="1.0"
)

# CORS設定 多分最後のurl/の/は必要ない
origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Hello World"}

# APIルーターの登録
# DB のプロジェクト
app.include_router(member.router)
app.include_router(project.router)
app.include_router(project_document.router)
app.include_router(env.router)
app.include_router(task_assignment.router)
app.include_router(project_qa.router)
app.include_router(project_member.router)
app.include_router(project_ai_document.router, prefix="/project", tags=["Project-AIDocument"])
app.include_router(task.router)




# APIサービス
app.include_router(qanda.router, prefix="/api/question", tags=["Q&A"])
app.include_router(summary.router, prefix="/api/summary", tags=["Summary"])
app.include_router(framework.router, prefix="/api/framework", tags=["Framework"])
app.include_router(directory.router, prefix="/api/directory", tags=["Directory"])
app.include_router(environment.router, prefix="/api/environment", tags=["Environment"])
app.include_router(taskDetail.router, prefix="/api/taskDetail", tags=["TaskDetail"])
app.include_router(taskChat.router, prefix="/api/taskChat", tags=["TaskChat"])
app.include_router(graphTask.router, prefix="/api/graphTask", tags=["GraphTask"])
app.include_router(durationTask.router, prefix="/api/durationTask", tags=["DurationTask"])
app.include_router(deploy.router, prefix="/api/deploy", tags=["Deploy"])
app.include_router(function_requirements.router, prefix="/api/function_requirements", tags=["FunctionRequirements"])
app.include_router(function_structuring.router, prefix="/api/function_structuring", tags=["FunctionStructuring"])
app.include_router(technology.router, prefix="/api/technology", tags=["Technology"])
app.include_router(task_generation.router, prefix="/api/task_generation", tags=["TaskGeneration"])
app.include_router(task_quality.router, prefix="/api/task_quality", tags=["TaskQuality"])
app.include_router(complete_task_generation.router, prefix="/api/complete_task_generation", tags=["CompleteTaskGeneration"])
app.include_router(task_dependency.router, prefix="/api/task_dependencies", tags=["TaskDependency"])
app.include_router(ai_document.router, prefix="/api/ai_document", tags=["AIDocument"])



# 適宜追加

if __name__ == '__main__':
    import uvicorn
    uvicorn.run("app:app", host="localhost", port=8000, reload=True)
