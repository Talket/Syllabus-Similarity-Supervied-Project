import React from 'react';
import { Stage, StageProps } from '../stage/Stage';

export type SceneOrchestratorProps = StageProps;

export const SceneOrchestrator: React.FC<StageProps> = (props) => {
  return <Stage {...props} />;
};

export default SceneOrchestrator;
