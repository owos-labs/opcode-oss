import { InventoryEditor } from "@/app/components/inventory-editor";

type InventoryPageProps = {
  searchParams: Promise<{ item?: string | string[] | undefined }>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = await searchParams;
  const item = Array.isArray(params.item) ? params.item[0] : params.item;
  return <InventoryEditor initialItemId={item ?? null} />;
}
