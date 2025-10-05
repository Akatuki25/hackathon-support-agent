from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# APIルーターのインポート
from routers.project import member , project , project_document, env, task_assignment,project_qa,project_member
from routers import qanda, summary, framework, directory, environment,  taskDetail, graphTask, durationTask, deploy, function_requirements, technology

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




# APIサービス
app.include_router(qanda.router, prefix="/api/question", tags=["Q&A"])
app.include_router(summary.router, prefix="/api/summary", tags=["Summary"])
app.include_router(framework.router, prefix="/api/framework", tags=["Framework"])
app.include_router(directory.router, prefix="/api/directory", tags=["Directory"])
app.include_router(environment.router, prefix="/api/environment", tags=["Environment"])
app.include_router(taskDetail.router, prefix="/api/taskDetail", tags=["TaskDetail"])
app.include_router(graphTask.router, prefix="/api/graphTask", tags=["GraphTask"])
app.include_router(durationTask.router, prefix="/api/durationTask", tags=["DurationTask"])
app.include_router(deploy.router, prefix="/api/deploy", tags=["Deploy"])
app.include_router(function_requirements.router, prefix="/api/function_requirements", tags=["FunctionRequirements"])
app.include_router(technology.router, prefix="/api/technology", tags=["Technology"])



# 適宜追加

if __name__ == '__main__':
    import uvicorn
    uvicorn.run("app:app", host="localhost", port=8000, reload=True)
