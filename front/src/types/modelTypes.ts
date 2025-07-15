import { UUID } from "crypto";

export type MemberType = {
    member_name: string;
    member_skill: string;
    github_name: string;
}
export type MemberResponseType ={
    member_id: number;
    message : string;
}


export type ProjectType = {
    Id ?: UUID;
    title: string;
    idea: string;
    start_date: string;
    end_date: string;
    num_people: number;
}

export type ProjectDocumentType = {
    project_id ?: string;
    specification_doc: string;
    frame_work_doc: string;
    directory_info : string;
}

    