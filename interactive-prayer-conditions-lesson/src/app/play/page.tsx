import PlayClient from "@/components/PlayClient";
export const dynamic="force-dynamic";
export default async function PlayPage({searchParams}:{searchParams:Promise<{room?:string}>}){const {room}=await searchParams;return <PlayClient initialCode={(room??"").toUpperCase().slice(0,8)}/>;}
