import { responseStatusLabels } from '../../utils/responseSimulation.js';

export default function StatusBadge({ status }) {
  return <span className={'status-badge ' + status}><i />{responseStatusLabels[status] ?? status}</span>;
}
