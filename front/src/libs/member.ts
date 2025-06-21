import { MemberResponseType, MemberType } from "@/types/modelTypes"

export const postMember = async (member: MemberType) => {

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    console.log(member);

    const response = await fetch(`${apiUrl}/member/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify( member),
    });

    if (!response.ok) {
        throw new Error(`API エラー: ${response.status} ${response.statusText}`);
    }

    const data: MemberResponseType = await response.json();
    const ID = data.member_id;
    return ID;
}