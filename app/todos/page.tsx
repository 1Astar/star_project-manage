import { redirect } from "next/navigation";

/** 待办已并入工作台「今日要做」 */
export default function TodosPage() {
  redirect("/?focus=pm-today");
}
