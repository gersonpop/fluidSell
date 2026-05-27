import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.manager";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  return (
    <NewPagePattern
      title="manager"
      description="manager"
    >
      <DynamicComponent />
    </NewPagePattern>
  );
}