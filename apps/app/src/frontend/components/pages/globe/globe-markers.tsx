import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { useSnapshot } from 'valtio';
import { useGlobeStore } from '@/stores/globe-store';
import type { GlobeUserBucket } from '@/utils/trpc';
import { GlobeMarker } from './globe-marker';

interface Props {
  projectId: string;
  timespan: TimeSpan;
  startDate?: string;
  endDate?: string;
  buckets: GlobeUserBucket[];
  setMarkerElement: (id: string, element: HTMLDivElement | null) => void;
}

export const GlobeMarkers = (props: Props) => {
  const { projectId, timespan, startDate, endDate, buckets, setMarkerElement } = props;
  const { store, actions } = useGlobeStore();
  const { openBucketId, selectedMarkerUserId } = useSnapshot(store);

  return (
    <>
      {buckets.map((bucket) => (
        <GlobeMarker
          key={bucket.id}
          projectId={projectId}
          timespan={timespan}
          startDate={startDate}
          endDate={endDate}
          isOpen={openBucketId === bucket.id}
          setOpen={actions.changeOpenMarker}
          selectedUserId={openBucketId === bucket.id ? selectedMarkerUserId : null}
          setSelectedUserId={actions.setSelectedMarkerUserId}
          {...bucket}
          setMarkerElement={setMarkerElement}
        />
      ))}
    </>
  );
};
