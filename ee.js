import { toast } from "sonner"
import { useUserActivityAPI } from '../lib/getUsage'
import { useRouter } from 'next/navigation';
import { triggerProButtonDialog } from '@/lib/utils';

const { getUserActivityUsage, decrementUserActivityUsage } = useUserActivityAPI();


if (await getUserActivityUsage('summary') == 0) {
  toast("Free limit finished, Buy premium!", {
    description: "For 5.99$ get higher usage limits",
    action: {
      label: "Buy",
      onClick: () => triggerProButtonDialog(),
    },
  })
}
decrementUserActivityUsage('summary')