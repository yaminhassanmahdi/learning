import Image from "next/image";
import { BadgePlus, SendHorizontal } from "lucide-react";
export default function SearchBar() {
  return (
    <div className="flex flex-row absolute rounded-full left-1/2 transform -translate-x-1/2 mx-auto  bottom-4 h-[3rem] py-1 px-4 w-[57rem] bg-slate-50 ">
      {/* <button className="p-5 justify-center items-center rounded-full w-5 h-5 bg-slate-200 text-black mr-5 cursor-pointer"></button> */}
      <div className="rounded-full w-10 h-10 flex flex-col justify-center items-center  bg-amer-300 cursor-pointer mr-3">
        <BadgePlus size={34} fill={"black"} />
      </div>
      <input
        className="w-[90%] text-slate-800 outline-0"
        placeholder="Type your search..."
      />
      <div className="p-2  bgslate-200 text-black mr-5 cursor-pointer flex flex-col justify-center items-center">
        <SendHorizontal size={34} fill={"white"} />
      </div>
    </div>
  );
}
