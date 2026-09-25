import { Skeleton, SkeletonText } from '@/components/ui/skeleton'

export function SkeletonsSection() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton shape="circle" className="size-12" />
        <Skeleton className="h-8 w-40" />
      </div>
      <SkeletonText lines={3} />
    </div>
  )
}
