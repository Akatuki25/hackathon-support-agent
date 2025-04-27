// 基本的にここでAPIの呼び出しだけを行う関数を定義する
export const postQuestion = async (promptText :string) => {

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    const response = await fetch(`${apiUrl}/api/question/`, {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        // バックエンドの Pydantic モデルに合わせ、キーは "Prompt"
        body: JSON.stringify({ Prompt: promptText }),
    });
    
    if (!response.ok) {
        throw new Error(`API エラー: ${response.status} ${response.statusText}`);
    }
    console.log("API response:", response);
    const data: { result: { Question: string } } = await response.json();

    const formattedData = {
        yume_answer: {
        Answer: data.result.Question,
        },
    }
    return formattedData;
}