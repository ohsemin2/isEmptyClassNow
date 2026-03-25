import { getClassroomData } from '@/lib/parseSchedule';
import ClassroomSearch from './components/ClassroomSearch';

export default function Home() {
  const data = getClassroomData();
  return <ClassroomSearch data={data} />;
}
