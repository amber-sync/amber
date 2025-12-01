import React from 'react';
import { Icons } from '../IconComponents';
import { Panel, SectionHeader, TextInput } from '../ui';

interface JobIdentityFormProps {
  jobName: string;
  setJobName: (val: string) => void;
}

export const JobIdentityForm: React.FC<JobIdentityFormProps> = ({ jobName, setJobName }) => {
  return (
    <Panel variant="form" className="flex flex-col h-full">
      <SectionHeader variant="form-label">Job Name</SectionHeader>
      <div className="flex-1 flex items-center">
        <TextInput
          value={jobName}
          onChange={e => setJobName(e.target.value)}
          placeholder="e.g. Daily Backup"
          icon={<Icons.Tag size={18} />}
        />
      </div>
    </Panel>
  );
};
