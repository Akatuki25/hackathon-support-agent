export const frameWorkdocument = async (
  specification: string,
  framework: string,
) => {
  const data = await fetch(
    process.env.NEXT_PUBLIC_API_URL + "/api/framework/document",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specification,
        framework,
      }),
    },
  );
  if (!data.ok) {
    throw new Error(`API エラー: ${data.status} ${data.statusText}`);
  }
  const res: string = await data.json();
  return res;
};
