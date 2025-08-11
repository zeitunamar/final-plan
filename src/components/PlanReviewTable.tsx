import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { exportToExcel, exportToPDF, processDataForExport } from '../lib/utils/export';
import { organizations, auth } from '../lib/api';
import axios from 'axios';

interface PlanReviewTableProps {
  objectives: StrategicObjective[]; // This should be the plan's selected objectives with their data
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  organizationName: string;
  plannerName: string;
  fromDate: string;
  toDate: string;
  planType: string;
  isPreviewMode?: boolean;
  userOrgId?: number | null;
  isViewOnly?: boolean;
  planData?: any; // Add plan data to get selected objectives and weights
}

// Production-safe API helper with comprehensive retry logic
const productionSafeAPI = {
  async fetchWithRetry(apiCall: () => Promise<any>, description: string, maxRetries = 3): Promise<any> {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`${description} - Attempt ${attempt}/${maxRetries}`);
        
        // Set timeout based on attempt (shorter timeouts on later attempts)
        const timeout = Math.max(8000, 20000 - (attempt * 4000));
        
        const result = await Promise.race([
          apiCall(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
          )
        ]);
        
        console.log(`${description} - Success on attempt ${attempt}`);
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`${description} - Attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
          console.log(`${description} - Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    console.warn(`${description} - All attempts failed, returning empty data`);
    throw lastError;
  },

  async getInitiativesForObjective(objectiveId: string): Promise<any[]> {
    try {
      const result = await this.fetchWithRetry(async () => {
        const timestamp = new Date().getTime();
        
        // Try multiple API call strategies
        try {
          // Strategy 1: Standard API call
          return await api.get(`/strategic-initiatives/?objective=${objectiveId}&_=${timestamp}`, {
            timeout: 10000,
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
          });
        } catch (error1) {
          console.warn('Strategy 1 failed, trying strategy 2...');
          
          try {
            // Strategy 2: Alternative parameter format
            return await api.get('/strategic-initiatives/', {
              params: { objective: objectiveId, _: timestamp },
              timeout: 8000,
              headers: { 'Cache-Control': 'no-cache' }
            });
          } catch (error2) {
            console.warn('Strategy 2 failed, trying strategy 3...');
            
            // Strategy 3: Direct axios call
            return await axios.get(`/api/strategic-initiatives/`, {
              params: { objective: objectiveId },
              timeout: 5000,
              withCredentials: true
            });
          }
        }
      }, `Fetching initiatives for objective ${objectiveId}`);
      
      const data = result?.data?.results || result?.data || [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn(`Failed to fetch initiatives for objective ${objectiveId}:`, error);
      return [];
    }
  },

  async getPerformanceMeasuresForInitiative(initiativeId: string): Promise<any[]> {
    try {
      const result = await this.fetchWithRetry(async () => {
        const timestamp = new Date().getTime();
        
        try {
          // Strategy 1: Standard API call
          return await api.get(`/performance-measures/?initiative=${initiativeId}&_=${timestamp}`, {
            timeout: 10000,
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
          });
        } catch (error1) {
          console.warn('Performance measures strategy 1 failed, trying strategy 2...');
          
          try {
            // Strategy 2: Alternative parameter format
            return await api.get('/performance-measures/', {
              params: { initiative: initiativeId, initiative_id: initiativeId, _: timestamp },
              timeout: 8000,
              headers: { 'Cache-Control': 'no-cache' }
            });
          } catch (error2) {
            console.warn('Performance measures strategy 2 failed, trying strategy 3...');
            
            // Strategy 3: Direct axios call
            return await axios.get(`/api/performance-measures/`, {
              params: { initiative: initiativeId },
              timeout: 5000,
              withCredentials: true
            });
          }
        }
      }, `Fetching performance measures for initiative ${initiativeId}`);
      
      const data = result?.data?.results || result?.data || [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn(`Failed to fetch performance measures for initiative ${initiativeId}:`, error);
      return [];
    }
  },

  async getMainActivitiesForInitiative(initiativeId: string): Promise<any[]> {
    try {
      const result = await this.fetchWithRetry(async () => {
        const timestamp = new Date().getTime();
        
        try {
          // Strategy 1: Standard API call
          return await api.get(`/main-activities/?initiative=${initiativeId}&_=${timestamp}`, {
            timeout: 10000,
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
          });
        } catch (error1) {
          console.warn('Main activities strategy 1 failed, trying strategy 2...');
          
          try {
            // Strategy 2: Alternative parameter format
            return await api.get('/main-activities/', {
              params: { initiative: initiativeId, initiative_id: initiativeId, _: timestamp },
              timeout: 8000,
              headers: { 'Cache-Control': 'no-cache' }
            });
          } catch (error2) {
            console.warn('Main activities strategy 2 failed, trying strategy 3...');
            
            // Strategy 3: Direct axios call
            return await axios.get(`/api/main-activities/`, {
              params: { initiative: initiativeId },
              timeout: 5000,
              withCredentials: true
            });
          }
        }
      }, `Fetching main activities for initiative ${initiativeId}`);
      
      const data = result?.data?.results || result?.data || [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn(`Failed to fetch main activities for initiative ${initiativeId}:`, error);
      return [];
    }
  }
};

const PlanReviewTable: React.FC<PlanReviewTableProps> = ({
  objectives,
  onSubmit,
  isSubmitting,
  organizationName,
  plannerName,
  fromDate,
  toDate,
  planType,
  isPreviewMode = false,
  userOrgId = null,
  isViewOnly = false,
  planData
}) => {
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, string>>({});
  const [currentUserOrgId, setCurrentUserOrgId] = useState<number | null>(userOrgId || null);
  const [authLoaded, setAuthLoaded] = useState<boolean>(!!userOrgId);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch organizations for mapping IDs to names
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await api.get('/organizations/');
        const orgMap: Record<string, string> = {};
        
        const orgsData = response.data?.results || response.data || [];
        if (Array.isArray(orgsData)) {
          orgsData.forEach((org: any) => {
            if (org && org.id) {
              orgMap[org.id] = org.name;
            }
          });
        }
        
        setOrganizationsMap(orgMap);
        console.log('Organizations map created for implementer display:', orgMap);
      } catch (error) {
        console.error('Failed to fetch organizations for implementer mapping:', error);
        // Set a fallback map
        setOrganizationsMap({});
      }
    };
    
    fetchOrganizations();
  }, []);
  const [processedObjectives, setProcessedObjectives] = useState<StrategicObjective[]>([]);

  // Get planner's organization ID from auth or plan data
  useEffect(() => {
    const initializePlannerContext = async () => {
      try {
        // First try to get from userOrgId prop
        if (userOrgId) {
          console.log('Using userOrgId prop:', userOrgId);
          setCurrentUserOrgId(userOrgId);
          setAuthLoaded(true);
          return;
        }
        
        // Try to get from plan data
        console.log('PlanReviewTable: Using provided userOrgId:', userOrgId);
        if (planData?.organization) {
          console.log('Using plan organization:', planData.organization);
          setCurrentUserOrgId(Number(planData.organization));
          setAuthLoaded(true);
          return;
        }
        
        // Fallback to current user's organization
        const authData = await auth.getCurrentUser();
        if (authData.userOrganizations?.length > 0) {
          const orgId = authData.userOrganizations[0].organization;
          console.log('Using current user organization:', orgId);
          setCurrentUserOrgId(orgId);
        }
      } catch (error) {
        console.error('Failed to get planner organization context:', error);
      } finally {
        setAuthLoaded(true);
      }
    };
    
    initializePlannerContext();
  }, [userOrgId, planData]);

  // Process and filter objectives to show only planner's organization data
  useEffect(() => {
    if (!authLoaded && !userOrgId) {
      console.log('PlanReviewTable: Waiting for auth to load (no userOrgId provided)...');
      return;
    }

    console.log('=== PROCESSING PLAN OBJECTIVES FOR PLANNER ORG ===');
    console.log('Planner Organization ID:', currentUserOrgId);
    console.log('Raw objectives received:', objectives?.length || 0);

    // Use the plan's selected objectives (these should already be filtered)
    const filteredObjectives = (objectives || []).map(objective => {
      if (!objective) return objective;

      console.log(`Processing objective: ${objective.title} (ID: ${objective.id})`);
      
      // Use the objective weight from the plan (effective_weight, planner_weight, or weight)
      const objectiveWeight = objective.effective_weight || 
                             objective.planner_weight || 
                             objective.weight;
      
      console.log(`Objective weight: ${objectiveWeight} (effective: ${objective.effective_weight}, planner: ${objective.planner_weight}, original: ${objective.weight})`);

      // Filter initiatives to ONLY show planner's organization data
      const plannerInitiatives = (objective.initiatives || []).filter(initiative => {
        const isDefault = initiative.is_default === true;
        const belongsToPlanner = Number(initiative.organization) === Number(currentUserOrgId);
        const hasNoOrg = !initiative.organization;
        
        // STRICT: Only include if it's default OR belongs to planner's organization
        const shouldInclude = isDefault || belongsToPlanner || hasNoOrg;
        
        console.log(`Initiative "${initiative.name}": isDefault=${isDefault}, org=${initiative.organization}, plannerOrg=${currentUserOrgId}, belongsToPlanner=${belongsToPlanner}, shouldInclude=${shouldInclude}`);
        
        return shouldInclude;
      });

      // For each initiative, filter measures and activities by planner organization
      const processedInitiatives = plannerInitiatives.map(initiative => {
        // Filter performance measures
        const plannerMeasures = (initiative.performance_measures || []).filter(measure => {
          const belongsToPlanner = Number(measure.organization) === Number(currentUserOrgId);
          const hasNoOrg = !measure.organization;
          const shouldInclude = belongsToPlanner || hasNoOrg;
          
          console.log(`Measure "${measure.name}": org=${measure.organization}, plannerOrg=${currentUserOrgId}, shouldInclude=${shouldInclude}`);
          return shouldInclude;
        });

        // Filter main activities
        const plannerActivities = (initiative.main_activities || []).filter(activity => {
          const belongsToPlanner = Number(activity.organization) === Number(currentUserOrgId);
          const hasNoOrg = !activity.organization;
          const shouldInclude = belongsToPlanner || hasNoOrg;
          
          console.log(`Activity "${activity.name}": org=${activity.organization}, plannerOrg=${currentUserOrgId}, shouldInclude=${shouldInclude}`);
          return shouldInclude;
        });

        return {
          ...initiative,
          performance_measures: plannerMeasures,
          main_activities: plannerActivities
        };
      });

      return {
        ...objective,
        effective_weight: objectiveWeight,
        initiatives: processedInitiatives
      };
    });

    console.log('Final processed objectives:', filteredObjectives.length);
    setProcessedObjectives(filteredObjectives);
  }, [objectives, currentUserOrgId, authLoaded]);

  // Fetch organizations for mapping names
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await organizations.getAll();
        const orgMap: Record<string, string> = {};
        
        if (response && Array.isArray(response)) {
          response.forEach((org: any) => {
            if (org && org.id) {
              orgMap[org.id] = org.name;
            }
          });
        }
        
        setOrganizationsMap(orgMap);
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      }
    };
    
    fetchOrganizations();
  }, []);

  // Helper function to filter data by organization - ONLY show user's organization data
  const filterByUserOrganization = (objectives: any[]) => {
    if (!authLoaded) {
      console.log('PlanReviewTable - Auth not loaded yet, showing empty data');
      return [];
    }

    if (!Array.isArray(objectives)) {
      console.log('PlanReviewTable - Invalid objectives data');
      return [];
    }
    
    // Use the userOrgId prop if available, otherwise use currentUserOrgId
    const filterOrgId = userOrgId || currentUserOrgId;
    
    if (!filterOrgId) {
      console.log('PlanReviewTable - No organization ID available for filtering');
      // If no organization ID, show all objectives but filter initiatives
      return objectives.map(objective => ({
        ...objective,
        initiatives: []
      }));
    }
    
    console.log('PlanReviewTable - Filtering for organization:', filterOrgId);
    
    return objectives.map(objective => {
      if (!objective.initiatives) {
        return objective;
      }
      
      // Filter initiatives: Show defaults OR user organization initiatives
      const userInitiatives = objective.initiatives.filter(initiative => {
        const isDefault = initiative.is_default === true;
        const belongsToUserOrg = Number(initiative.organization) === Number(filterOrgId);
        const hasNoOrg = !initiative.organization; // Legacy data
        
        const shouldInclude = isDefault || belongsToUserOrg || hasNoOrg;
        
        console.log(`PlanReviewTable - Filter initiative "${initiative.name}": isDefault=${isDefault}, org=${initiative.organization}, filterOrg=${filterOrgId}, belongsToUser=${belongsToUserOrg}, hasNoOrg=${hasNoOrg}, INCLUDE=${shouldInclude}`);
        
        return shouldInclude;
      });
      
      // For each initiative, filter measures and activities by organization
      const filteredInitiatives = userInitiatives.map(initiative => {
        const filteredMeasures = (initiative.performance_measures || []).filter(measure => {
          const belongsToUserOrg = !measure.organization || Number(measure.organization) === Number(filterOrgId);
          
          console.log(`PlanReviewTable - Filter measure "${measure.name}": org=${measure.organization}, filterOrg=${filterOrgId}, belongsToUser=${belongsToUserOrg}`);
          return belongsToUserOrg;
        });
        
        const filteredActivities = (initiative.main_activities || []).filter(activity => {
          const belongsToUserOrg = !activity.organization || Number(activity.organization) === Number(filterOrgId);
          
          console.log(`PlanReviewTable - Filter activity "${activity.name}": org=${activity.organization}, filterOrg=${filterOrgId}, belongsToUser=${belongsToUserOrg}`);
          return belongsToUserOrg;
        });
        
        return {
          ...initiative,
          performance_measures: filteredMeasures,
          main_activities: filteredActivities
        };
      });
      
      return {
        ...objective,
        initiatives: filteredInitiatives
      };
    });
  };

  // Filter objectives data before displaying
  const filteredObjectives = React.useMemo(() => {
    console.log('PlanReviewTable - Processing objectives for filtering:', objectives?.length || 0);
    
    if (!authLoaded) {
      console.log('PlanReviewTable - Auth not loaded, returning empty array');
      return [];
    }
    
    return filterByUserOrganization(objectives || []);
  }, [objectives, currentUserOrgId, userOrgId, authLoaded]);

  // Enhanced data fetching for production
  const fetchCompleteData = async (objectivesList: any[]) => {
    if (!objectivesList || objectivesList.length === 0) {
      console.log('No objectives to process');
      return [];
    }

    if (!currentUserOrgId) {
      console.error('PlanReviewTable: No user organization ID available for filtering');
      return [];
    }
    console.log(`Processing ${objectivesList.length} objectives for complete data`);
    setLoadingProgress('Initializing data fetch...');
    
    const enrichedObjectives = [];

    for (let i = 0; i < objectivesList.length; i++) {
      const objective = objectivesList[i];
      if (!objective) continue;

      try {
        setLoadingProgress(`Processing objective ${i + 1}/${objectivesList.length}: ${objective.title}`);
        console.log(`Processing objective ${objective.id} (${objective.title})`);

        // Fetch initiatives for this objective with production-safe API
        setLoadingProgress(`Fetching initiatives for ${objective.title}...`);
        const objectiveInitiatives = await productionSafeAPI.getInitiativesForObjective(objective.id.toString());
        
        console.log(`Found ${objectiveInitiatives.length} initiatives for objective ${objective.id}`);

        // CRITICAL FIX: SUPER STRICT filtering - NEVER show initiatives from other organizations
        const filteredInitiatives = objectiveInitiatives.filter(initiative => {
          // ABSOLUTE FILTERING: Only include initiatives that are either:
          // 1. Default initiatives (available to all)
          // 2. Created by the EXACT same organization as the current user
          const isDefault = initiative.is_default === true;
          const belongsToCurrentUserOrg = initiative.organization === currentUserOrgId;
          const hasNoOrg = !initiative.organization; // Legacy data without organization
          
          // SUPER STRICT: Only include if it's a default initiative OR explicitly belongs to current user's organization
          const shouldInclude = isDefault || belongsToCurrentUserOrg;
          
          // ABSOLUTE EXCLUSION: If initiative has an organization and it's NOT the current user's, ALWAYS exclude
          if (initiative.organization && initiative.organization !== currentUserOrgId && !isDefault) {
            console.log(`ABSOLUTELY EXCLUDING Initiative "${initiative.name}": belongs to org ${initiative.organization}, not current org ${currentUserOrgId}`);
            return false;
          }
          
          console.log(`PlanReviewTable Initiative Filter: "${initiative.name}" - isDefault=${isDefault}, org=${initiative.organization}, currentUserOrg=${currentUserOrgId}, belongsToCurrentUser=${belongsToCurrentUserOrg}, FINAL_DECISION=${shouldInclude}`);
          
          return shouldInclude;
        });

        console.log(`PlanReviewTable: Filtered from ${objectiveInitiatives.length} to ${filteredInitiatives.length} initiatives for current user org ${currentUserOrgId}`);

        // Process each initiative sequentially to avoid overwhelming the server
        const enrichedInitiatives = [];
        
        for (let j = 0; j < filteredInitiatives.length; j++) {
          const initiative = filteredInitiatives[j];
          if (!initiative) continue;

          try {
            setLoadingProgress(`Processing initiative ${j + 1}/${filteredInitiatives.length}: ${initiative.name}`);
            console.log(`Processing initiative ${initiative.id} (${initiative.name})`);

            // Fetch performance measures and main activities in parallel but with production-safe API
            const [performanceMeasuresData, mainActivitiesData] = await Promise.allSettled([
              productionSafeAPI.getPerformanceMeasuresForInitiative(initiative.id),
              productionSafeAPI.getMainActivitiesForInitiative(initiative.id)
            ]);

            // Handle results with fallback to empty arrays
            const measures = performanceMeasuresData.status === 'fulfilled' ? performanceMeasuresData.value : [];
            const activities = mainActivitiesData.status === 'fulfilled' ? mainActivitiesData.value : [];

            // ABSOLUTE FILTERING: Measures and activities MUST belong to current user organization
            const filteredMeasures = measures.filter(measure => {
              const belongsToCurrentUserOrg = measure.organization === currentUserOrgId;
              const hasNoOrg = !measure.organization; // Legacy data
              
              // ABSOLUTE FILTERING: Only include measures from current user's organization
              const shouldInclude = belongsToCurrentUserOrg || hasNoOrg;
              
              // ABSOLUTE EXCLUSION: If measure belongs to another organization, NEVER include
              if (measure.organization && measure.organization !== currentUserOrgId) {
                console.log(`ABSOLUTELY EXCLUDING Measure "${measure.name}": belongs to org ${measure.organization}, not current user org ${currentUserOrgId}`);
                return false;
              }
              
              console.log(`PlanReviewTable Measure Filter: "${measure.name}" - org=${measure.organization}, currentUserOrg=${currentUserOrgId}, belongsToCurrentUser=${belongsToCurrentUserOrg}, FINAL_DECISION=${shouldInclude}`);
              
              return shouldInclude;
            });
            
            const filteredActivities = activities.filter(activity => {
              const belongsToCurrentUserOrg = activity.organization === currentUserOrgId;
              const hasNoOrg = !activity.organization; // Legacy data
              
              // ABSOLUTE FILTERING: Only include activities from current user's organization
              const shouldInclude = belongsToCurrentUserOrg || hasNoOrg;
              
              // ABSOLUTE EXCLUSION: If activity belongs to another organization, NEVER include
              if (activity.organization && activity.organization !== currentUserOrgId) {
                console.log(`ABSOLUTELY EXCLUDING Activity "${activity.name}": belongs to org ${activity.organization}, not current user org ${currentUserOrgId}`);
                return false;
              }
              
              console.log(`PlanReviewTable Activity Filter: "${activity.name}" - org=${activity.organization}, currentUserOrg=${currentUserOrgId}, belongsToCurrentUser=${belongsToCurrentUserOrg}, FINAL_DECISION=${shouldInclude}`);
              
              return shouldInclude;
            });

            console.log(`Initiative ${initiative.id}: ${filteredMeasures.length} measures, ${filteredActivities.length} activities`);

            enrichedInitiatives.push({
              ...initiative,
              performance_measures: filteredMeasures,
              main_activities: filteredActivities
            });

            // Small delay between initiatives to prevent server overload
            if (j < filteredInitiatives.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }

          } catch (initiativeError) {
            console.warn(`Error processing initiative ${initiative.id}:`, initiativeError);
            // Add initiative with empty data instead of skipping
            enrichedInitiatives.push({
              ...initiative,
              performance_measures: [],
              main_activities: []
            });
          }
        }

        // Set effective weight
        const effectiveWeight = objective.planner_weight !== undefined && objective.planner_weight !== null
          ? objective.planner_weight
          : objective.weight;

        enrichedObjectives.push({
          ...objective,
          effective_weight: effectiveWeight,
          initiatives: enrichedInitiatives
        });

        console.log(`Completed objective ${objective.id}: ${enrichedInitiatives.length} enriched initiatives`);

        // Small delay between objectives
        if (i < objectivesList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (objectiveError) {
        console.warn(`Error processing objective ${objective.id}:`, objectiveError);
        // Add objective with empty initiatives instead of skipping
        enrichedObjectives.push({
          ...objective,
          effective_weight: objective.weight,
          initiatives: []
        });
      }
    }

    console.log(`=== PROCESSING COMPLETE ===`);
    console.log(`Successfully processed ${enrichedObjectives.length} objectives`);
    
    const totalInitiatives = enrichedObjectives.reduce((sum, obj) => sum + (obj.initiatives?.length || 0), 0);
    const totalMeasures = enrichedObjectives.reduce((sum, obj) => 
      sum + (obj.initiatives?.reduce((iSum, init) => iSum + (init.performance_measures?.length || 0), 0) || 0), 0);
    const totalActivities = enrichedObjectives.reduce((sum, obj) => 
      sum + (obj.initiatives?.reduce((iSum, init) => iSum + (init.main_activities?.length || 0), 0) || 0), 0);
    
    console.log(`FINAL TOTALS: ${totalInitiatives} initiatives, ${totalMeasures} measures, ${totalActivities} activities`);

    return enrichedObjectives;
  };

  // Load complete data when component mounts or objectives change
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      // If this is preview mode or view only, use the objectives directly without refetching
      if (isPreviewMode || isViewOnly) {
        console.log('Preview/View mode: Using provided objectives directly');
        console.log('Provided objectives:', objectives?.length || 0);
        
        if (objectives && objectives.length > 0) {
          // CRITICAL FIX: Even in preview mode, filter the provided objectives to remove other org data
          const strictlyFilteredObjectives = objectives.map(objective => {
            if (!objective.initiatives) return objective;
            
            // Filter initiatives to ONLY include current user's organization or defaults
            const userInitiatives = objective.initiatives.filter(initiative => {
              const isDefault = initiative.is_default === true;
              const belongsToCurrentUser = initiative.organization === currentUserOrgId;
              const hasNoOrg = !initiative.organization;
              const shouldInclude = isDefault || belongsToCurrentUser;
              
              // ABSOLUTE EXCLUSION: If initiative belongs to another organization, NEVER include
              if (initiative.organization && initiative.organization !== currentUserOrgId && !isDefault) {
                console.log(`PREVIEW MODE EXCLUDING Initiative "${initiative.name}": belongs to org ${initiative.organization}, not current user org ${currentUserOrgId}`);
                return false;
              }
              
              console.log(`Preview Initiative Filter: "${initiative.name}" - isDefault=${isDefault}, org=${initiative.organization}, currentUserOrg=${currentUserOrgId}, FINAL_DECISION=${shouldInclude}`);
              return shouldInclude;
            });
            
            // Filter measures and activities within each initiative
            const filteredInitiatives = userInitiatives.map(initiative => {
              const filteredMeasures = (initiative.performance_measures || []).filter(measure => {
                const belongsToCurrentUser = measure.organization === currentUserOrgId;
                const hasNoOrg = !measure.organization;
                const shouldInclude = belongsToCurrentUser || hasNoOrg;
                
                if (measure.organization && measure.organization !== currentUserOrgId) {
                  console.log(`PREVIEW MODE EXCLUDING Measure "${measure.name}": belongs to org ${measure.organization}, not current user org ${currentUserOrgId}`);
                  return false;
                }
                
                return shouldInclude;
              });
              
              const filteredActivities = (initiative.main_activities || []).filter(activity => {
                const belongsToCurrentUser = activity.organization === currentUserOrgId;
                const hasNoOrg = !activity.organization;
                const shouldInclude = belongsToCurrentUser || hasNoOrg;
                
                if (activity.organization && activity.organization !== currentUserOrgId) {
                  console.log(`PREVIEW MODE EXCLUDING Activity "${activity.name}": belongs to org ${activity.organization}, not current user org ${currentUserOrgId}`);
                  return false;
                }
                
                return shouldInclude;
              });
              
              return {
                ...initiative,
                performance_measures: filteredMeasures,
                main_activities: filteredActivities
              };
            });
            
            return {
              ...objective,
              initiatives: filteredInitiatives
            };
          });
          
          // Log the structure of provided objectives
          strictlyFilteredObjectives.forEach((obj, index) => {
            const initiativesCount = obj.initiatives?.length || 0;
            const measuresCount = obj.initiatives?.reduce((sum, init) => sum + (init.performance_measures?.length || 0), 0) || 0;
            const activitiesCount = obj.initiatives?.reduce((sum, init) => sum + (init.main_activities?.length || 0), 0) || 0;
            console.log(`PlanReviewTable Filtered Objective ${index + 1}: ${obj.title} - ${initiativesCount} initiatives, ${measuresCount} measures, ${activitiesCount} activities`);
          });
          
          setProcessedObjectives(strictlyFilteredObjectives);
          return;
        }
      }
      
      // Only fetch data if not in preview/view mode
      if (!objectives || objectives.length === 0) {
        setProcessedObjectives([]);
        setIsLoading(false);
        return;
      }

      // Wait for userOrgId to be available before processing
      if (!currentUserOrgId) {
        return;
      }
      
      try {
        setIsLoading(true);
        
        // If we have plan data with objectives, use that
        if (planData?.objectives && Array.isArray(planData.objectives)) {
          console.log('PlanReviewTable: Using plan objectives data:', planData.objectives.length);
          setProcessedObjectives(planData.objectives);
          setIsLoading(false);
          return;
        }
        
        // On error, just use the provided objectives
        setProcessedObjectives(objectives);
      } catch (error) {
        console.error('Error loading plan data:', error);
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'Failed to load plan data');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [objectives, currentUserOrgId, authLoaded, planData, userOrgId]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
  };

  const handleExportExcel = () => {
    const exportData = processDataForExport(processedObjectives, 'en');
    exportToExcel(
      exportData,
      `plan-${new Date().toISOString().slice(0, 10)}`,
      'en',
      {
        organization: organizationName,
        planner: plannerName,
        fromDate: fromDate,
        toDate: toDate,
        planType: planType
      }
    );
  };

  const handleExportPDF = () => {
    const exportData = processDataForExport(processedObjectives, 'en');
    exportToPDF(
      exportData,
      `plan-${new Date().toISOString().slice(0, 10)}`,
      'en',
      {
        organization: organizationName,
        planner: plannerName,
        fromDate: fromDate,
        toDate: toDate,
        planType: planType
      }
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  const formatCurrency = (value: any): string => {
    if (!value || value === 'N/A') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    return `$${numValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const calculateTotalBudget = () => {
    let total = 0;
    let governmentTotal = 0;
    let sdgTotal = 0;
    let partnersTotal = 0;
    let otherTotal = 0;

    if (!processedObjectives) return { total, governmentTotal, sdgTotal, partnersTotal, otherTotal };

    try {
      processedObjectives.forEach((objective: any) => {
        objective?.initiatives?.forEach((initiative: any) => {
          initiative?.main_activities?.forEach((activity: any) => {
            const cost = activity.budget.budget_calculation_type === 'WITH_TOOL' 
              ? Number(activity.budget.estimated_cost_with_tool || 0) 
              : Number(activity.budget.estimated_cost_without_tool || 0);
            
            total += cost;
            governmentTotal += Number(activity.budget.government_treasury || 0);
            sdgTotal += Number(activity.budget.sdg_funding || 0);
            partnersTotal += Number(activity.budget.partners_funding || 0);
            otherTotal += Number(activity.budget.other_funding || 0);
          });
        });
      });
    } catch (e) {
      console.error('Error calculating total budget:', e);
    }

    return { total, governmentTotal, sdgTotal, partnersTotal, otherTotal };
  };

  const budgetTotals = calculateTotalBudget();
  const totalAvailable = budgetTotals.governmentTotal + budgetTotals.sdgTotal + budgetTotals.partnersTotal + budgetTotals.otherTotal;
  const fundingGap = Math.max(0, budgetTotals.total - totalAvailable);

  // Wait for authentication to load only if we don't have userOrgId
  if (!authLoaded && !userOrgId) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Loading organization data...</span>
      </div>
    );
  }

  // Show loading state while fetching user organization or processing data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Loading organization data...</span>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">Failed to Load Plan Data</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!filteredObjectives || filteredObjectives.length === 0) {
    return (
      <div className="p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
        <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-800 mb-2">No Plan Data Available</h3>
        <p className="text-gray-600">No objectives found to display in the plan table.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center">
            <Building2 className="h-4 w-4 text-gray-500 mr-2" />
            <div>
              <p className="text-gray-500">Organization</p>
              <p className="font-medium">{organizationName}</p>
            </div>
          </div>
          <div className="flex items-center">
            <User className="h-4 w-4 text-gray-500 mr-2" />
            <div>
              <p className="text-gray-500">Planner</p>
              <p className="font-medium">{plannerName}</p>
            </div>
          </div>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 text-gray-500 mr-2" />
            <div>
              <p className="text-gray-500">Period</p>
              <p className="font-medium">{formatDate(fromDate)} - {formatDate(toDate)}</p>
            </div>
          </div>
          <div className="flex items-center">
            <Target className="h-4 w-4 text-gray-500 mr-2" />
            <div>
              <p className="text-gray-500">Plan Type</p>
              <p className="font-medium">{planType}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export buttons */}
      {!isViewOnly && (
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleExportExcel}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FilePdf className="h-4 w-4 mr-2" />
            Export PDF
          </button>
        </div>
      )}

      {/* Budget Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Budget</p>
              <p className="text-2xl font-semibold text-blue-600">{formatCurrency(budgetTotals.total)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Available Funding</p>
              <p className="text-2xl font-semibold text-green-600">{formatCurrency(totalAvailable)}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Funding Gap</p>
              <p className="text-2xl font-semibold text-red-600">{formatCurrency(fundingGap)}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Funding Rate</p>
              <p className="text-2xl font-semibold text-purple-600">
                {budgetTotals.total > 0 ? Math.round((totalAvailable / budgetTotals.total) * 100) : 0}%
              </p>
            </div>
            <Activity className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Plan Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-green-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">No.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Strategic Objective</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Weight</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Strategic Initiative</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Initiative Weight</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Performance Measure/Main Activity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Weight</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Baseline</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Q1 Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Q2 Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">6-Month Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Q3 Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Q4 Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Annual Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Implementor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Budget Required</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Government</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Partners</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">SDG</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Other</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Total Available</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Gap</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredObjectives.map((objective, objIndex) => {
                let objectiveRowSpan = 0;
                
                // Calculate total rows for this objective
                objective.initiatives?.forEach((initiative: any) => {
                  const measuresCount = initiative.performance_measures?.length || 0;
                  const activitiesCount = initiative.main_activities?.length || 0;
                  const totalItems = Math.max(1, measuresCount + activitiesCount);
                  objectiveRowSpan += totalItems;
                });
                
                if (objectiveRowSpan === 0) objectiveRowSpan = 1;

                let currentRow = 0;
                const rows: JSX.Element[] = [];

                if (!objective.initiatives || objective.initiatives.length === 0) {
                  // Objective with no initiatives
                  rows.push(
                    <tr key={`obj-${objective.id}-empty`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{objIndex + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{objective.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(objective.effective_weight || objective.planner_weight || objective.weight).toFixed(1)}%</td>
                      <td className="px-6 py-4 text-sm text-gray-500 italic">No initiatives</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                    </tr>
                  );
                } else {
                  objective.initiatives.forEach((initiative: any, initIndex: number) => {
                    const performanceMeasures = initiative.performance_measures || [];
                    const mainActivities = initiative.main_activities || [];
                    const allItems = [...performanceMeasures, ...mainActivities];

                    if (allItems.length === 0) {
                      // Initiative with no measures or activities
                      const isFirstRowForObjective = currentRow === 0;
                      rows.push(
                        <tr key={`init-${initiative.id}-empty`} className="hover:bg-gray-50">
                          {isFirstRowForObjective && (
                            <>
                              <td rowSpan={objectiveRowSpan} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200 bg-gray-50">
                                {objIndex + 1}
                              </td>
                              <td rowSpan={objectiveRowSpan} className="px-6 py-4 text-sm text-gray-900 border-r border-gray-200 bg-gray-50">
                                <div className="font-medium">{objective.title}</div>
                                {objective.description && (
                                  <div className="text-xs text-gray-500 mt-1">{objective.description}</div>
                                )}
                              </td>
                              <td rowSpan={objectiveRowSpan} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200 bg-gray-50">
                                {(objective.effective_weight || objective.planner_weight || objective.weight).toFixed(1)}%
                              </td>
                            </>
                          )}
                          <td className="px-6 py-4 text-sm text-gray-900">{initiative.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{initiative.weight}%</td>
                          <td className="px-6 py-4 text-sm text-gray-500 italic">No measures or activities</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{initiative.organization_name || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                        </tr>
                      );
                      currentRow++;
                    } else {
                      allItems.forEach((item: any, itemIndex: number) => {
                        const isFirstRowForObjective = currentRow === 0;
                        const isFirstRowForInitiative = itemIndex === 0;
                        const initiativeRowSpan = allItems.length;
                        const isPerformanceMeasure = performanceMeasures.includes(item);
                        
                        // Calculate budget values
                        let budgetRequired = 0;
                        let government = 0;
                        let partners = 0;
                        let sdg = 0;
                        let other = 0;
                        let totalAvailable = 0;
                        let gap = 0;
                        
                        if (!isPerformanceMeasure && item.budget) {
                          budgetRequired = item.budget.budget_calculation_type === 'WITH_TOOL' ? 
                            Number(item.budget.estimated_cost_with_tool || 0) : 
                            Number(item.budget.estimated_cost_without_tool || 0);
                          
                          government = Number(item.budget.government_treasury || 0);
                          partners = Number(item.budget.partners_funding || 0);
                          sdg = Number(item.budget.sdg_funding || 0);
                          other = Number(item.budget.other_funding || 0);
                          totalAvailable = government + partners + sdg + other;
                          gap = Math.max(0, budgetRequired - totalAvailable);
                        }
                        
                        // Calculate 6-month target
                        const sixMonthTarget = item.target_type === 'cumulative' 
                          ? Number(item.q1_target || 0) + Number(item.q2_target || 0) 
                          : Number(item.q2_target || 0);

                        rows.push(
                          <tr key={`${item.id}-${itemIndex}`} className="hover:bg-gray-50">
                            {isFirstRowForObjective && (
                              <>
                                <td rowSpan={objectiveRowSpan} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200 bg-gray-50">
                                  {objIndex + 1}
                                </td>
                                <td rowSpan={objectiveRowSpan} className="px-6 py-4 text-sm text-gray-900 border-r border-gray-200 bg-gray-50">
                                  <div className="font-medium">{objective.title}</div>
                                  {objective.description && (
                                    <div className="text-xs text-gray-500 mt-1">{objective.description}</div>
                                  )}
                                </td>
                                <td rowSpan={objectiveRowSpan} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200 bg-gray-50">
                                  {(objective.effective_weight || objective.planner_weight || objective.weight).toFixed(1)}%
                                </td>
                              </>
                            )}
                            {isFirstRowForInitiative && (
                              <>
                                <td rowSpan={initiativeRowSpan} className="px-6 py-4 text-sm text-gray-900 border-r border-gray-200 bg-blue-50">
                                  <div className="font-medium">{initiative.name}</div>
                                </td>
                                <td rowSpan={initiativeRowSpan} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200 bg-blue-50">
                                  {initiative.weight}%
                                </td>
                              </>
                            )}
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="flex items-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 ${
                                  isPerformanceMeasure ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {isPerformanceMeasure ? 'PM' : 'MA'}
                                </span>
                                {item.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.weight}%</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{item.baseline || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.q1_target || 0}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.q2_target || 0}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sixMonthTarget}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.q3_target || 0}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.q4_target || 0}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.annual_target || 0}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {initiative.organization_name || 
                               (initiative.organization && organizationsMap && organizationsMap[initiative.organization]) ||
                               (item.organization_name) ||
                               (item.organization && organizationsMap && organizationsMap[item.organization]) ||
                               'Ministry of Health'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(budgetRequired)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(government)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(partners)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(sdg)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(other)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(totalAvailable)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(gap)}</td>
                          </tr>
                        );
                        currentRow++;
                      });
                    }
                  });
                }

                return rows;
              })}
              
              {/* Summary Row */}
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td colSpan={15} className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                  TOTAL BUDGET
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {formatCurrency(budgetTotals.total)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {formatCurrency(budgetTotals.governmentTotal)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {formatCurrency(budgetTotals.partnersTotal)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {formatCurrency(budgetTotals.sdgTotal)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {formatCurrency(budgetTotals.otherTotal)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {formatCurrency(totalAvailable)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {formatCurrency(fundingGap)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Button */}
      {!isPreviewMode && !isViewOnly && (
        <div className="flex justify-end">
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
          >
            {isSubmitting ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Submitting Plan...
              </>
            ) : (
              'Submit Plan for Review'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default PlanReviewTable;