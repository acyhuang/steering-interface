import React, { useState } from 'react';
import { featuresApi } from '../lib/api';
import { ModifiedFeature } from '../models/features';
import { FeatureCard } from './FeatureCard';

const FeaturesPanel: React.FC = () => {
  const [modifiedFeatures, setModifiedFeatures] = useState<ModifiedFeature[]>([]);

  const refreshModifiedFeatures = async () => {
    try {
      const features = await featuresApi.getModifiedFeatures("default_session");
      setModifiedFeatures(features);
    } catch (error) {
      console.error('Failed to fetch modified features:', error);
    }
  };

  const handleFeatureModified = () => {
    refreshModifiedFeatures();
  };

  return (
    <div>
      {/* Render your FeatureCards here */}
    </div>
  );
};

export default FeaturesPanel; 