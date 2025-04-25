from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# APIルーターのインポート
from routers import qanda, summary, tasks, framework, directory, environment, projects, taskDetail, taskChat, graphTask, durationTask, deploy

app = FastAPI(
    title="LangChain Server",
    version="1.0"
)

# CORS設定 多分最後のurl/の/は必要ない
origins = ["https://hackson-support-agent-lzcy0oa36-vyumas-projects.vercel.app","http://localhost:3000","http://localhost:3001","https://hackson-support-agent-git-hotfix-depolygit-vyumas-projects.vercel.app","https://hackson-support-agent.vercel.app","https://hackson-support-agent-git-develop-vyumas-projects.vercel.app/"]
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
app.include_router(projects.router)
app.include_router(qanda.router, prefix="/api/question", tags=["Q&A"])
app.include_router(summary.router, prefix="/api/summary", tags=["Summary"])
app.include_router(tasks.router, prefix="/api/get_object_and_tasks", tags=["Tasks"])
app.include_router(framework.router, prefix="/api/framework", tags=["Framework"])
app.include_router(directory.router, prefix="/api/directory", tags=["Directory"])
app.include_router(environment.router, prefix="/api/environment", tags=["Environment"])
app.include_router(taskDetail.router, prefix="/api/taskDetail", tags=["TaskDetail"])
app.include_router(taskChat.router, prefix="/api/taskChat", tags=["TaskChat"])
app.include_router(graphTask.router, prefix="/api/graphTask", tags=["GraphTask"])
app.include_router(durationTask.router, prefix="/api/durationTask", tags=["DurationTask"])
app.include_router(deploy.router, prefix="/api/deploy", tags=["Deploy"])

# 適宜追加

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='localhost', port=8000)
