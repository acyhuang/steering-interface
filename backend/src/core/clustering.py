import logging
from typing import Dict, List, Set
from ..models.features import FeatureActivation, FeatureCluster
from .llm_client import LLMClient

logger = logging.getLogger(__name__)

# Keywords for predefined clusters
WRITING_STYLE_KEYWORDS: Set[str] = {
    "formal", "informal", "concise", "verbose", "technical", "simple",
    "academic", "conversational", "professional", "casual", "tone", "style",
    "writing", "language", "voice", "clarity", "eloquent", "articulate"
}

REASONING_METHOD_KEYWORDS: Set[str] = {
    "analytical", "creative", "critical", "logical", "intuitive", "methodical",
    "reasoning", "thinking", "approach", "perspective", "framework", "mindset",
    "problem-solving", "deductive", "inductive", "strategic", "systematic"
}

def assign_to_predefined_clusters(features: List[FeatureActivation]) -> Dict[str, List[FeatureActivation]]:
    """Assign features to predefined clusters based on keyword matching.
    
    Args:
        features: List of features to assign
        
    Returns:
        Dictionary mapping cluster names to lists of features
    """
    writing_style = []
    reasoning_method = []
    remaining = []
    
    logger.debug(f"Assigning {len(features)} features to predefined clusters")
    
    for feature in features:
        label = feature.label.lower()        
        # Check for Writing Style keywords
        writing_style_matches = [keyword for keyword in WRITING_STYLE_KEYWORDS if keyword in label]
        if writing_style_matches:
            writing_style.append(feature)
            continue
            
        # Check for Reasoning Method keywords
        reasoning_method_matches = [keyword for keyword in REASONING_METHOD_KEYWORDS if keyword in label]
        if reasoning_method_matches:
            reasoning_method.append(feature)
            continue
            
        # No matches found
        remaining.append(feature)
    
    # logger.info(f"Assigned {len(writing_style)} features to Writing Style, {len(reasoning_method)} to Reasoning Method, {len(remaining)} remaining")
    
    # if writing_style:
    #     logger.info(f"Writing Style features: {[f.label for f in writing_style]}")
    # if reasoning_method:
    #     logger.info(f"Reasoning Method features: {[f.label for f in reasoning_method]}")
    # if remaining:
    #     logger.info(f"Remaining features: {[f.label for f in remaining]}")
    
    return {
        "Writing Style": writing_style,
        "Reasoning Method": reasoning_method,
        "remaining": remaining
    }

async def cluster_features(
    llm_client: LLMClient,
    features: List[FeatureActivation],
    num_categories: int = 5,
    force_refresh: bool = False
) -> List[FeatureCluster]:
    """Cluster features into predefined and dynamic groups."""
    if not features:
        logger.warning("No features to cluster")
        return []
    
    logger.debug(f"Starting clustering of {len(features)} features")
    
    # First, assign features to predefined clusters
    clustered = assign_to_predefined_clusters(features)
    
    # Create FeatureCluster objects for predefined clusters
    result = []
    for name in ["Writing Style", "Reasoning Method"]:
        if clustered[name]:  # Only add if there are features in this cluster
            result.append(FeatureCluster(
                name=name,
                features=clustered[name],
                type="predefined"
            ))
    
    # Use LLM to cluster remaining features
    if clustered["remaining"]:
        try:
            # Extract just the labels for classification
            feature_labels = [f.label for f in clustered["remaining"]]
            logger.debug(f"Using LLM to cluster {len(feature_labels)} remaining features")
            
            # Get classification from LLM
            classification = await llm_client.cluster_features(
                feature_labels,
                num_categories=num_categories,
                force_refresh=force_refresh
            )
            
            logger.debug(f"LLM returned {len(classification)} clusters: {list(classification.keys())}")
            
            # Convert to FeatureCluster objects
            for category_name, feature_labels in classification.items():
                # Find the original FeatureActivation objects
                category_features = [
                    f for f in clustered["remaining"] 
                    if f.label in feature_labels
                ]
                
                if category_features:
                    result.append(FeatureCluster(
                        name=category_name,
                        features=category_features,
                        type="dynamic"
                    ))
        except Exception as e:
            logger.error(f"Error in LLM clustering: {str(e)}")
            # Fallback: put all remaining features in an "Other" category
            if clustered["remaining"]:
                logger.warning(f"Using fallback: putting all {len(clustered['remaining'])} remaining features in 'Other' cluster")
                result.append(FeatureCluster(
                    name="Other",
                    features=clustered["remaining"],
                    type="dynamic"
                ))
    
    logger.debug(f"Completed clustering with {len(result)} clusters")
    return result 