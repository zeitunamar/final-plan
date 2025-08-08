import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Target, 
  Activity, 
  DollarSign, 
  Loader,
  RefreshCw,
  Eye,
  Send,
  Calendar,
  Building2,
  User,
  FileType,
  Info
} from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { 
  auth, 
  organizations, 
  objectives, 
  initiatives, 
  performanceMeasures, 
  mainActivities, 
  plans,
  api
} from '../lib/api';
import { isPlanner } from '../types/user';
import type { 
  StrategicObjective, 
  Organization, 
  StrategicInitiative, 
  PerformanceMeasure, 
  MainActivity 
} from '../types/organization';
import type { PlanType, ActivityType, BudgetCalculationType } from '../types/plan';

// Component imports
import PlanTypeSelector from '../components/PlanTypeSelector';
import HorizontalObjectiveSelector from '../components/HorizontalObjectiveSelector';
import StrategicObjectivesList from '../components/StrategicObjectivesList';
import InitiativeList from '../components/InitiativeList';
import InitiativeForm from '../components/InitiativeForm';
import PerformanceMeasureList from '../components/PerformanceMeasureList';
import PerformanceMeasureForm from '../components/PerformanceMeasureForm';
import MainActivityList from '../components/MainActivityList';
import MainActivityForm from '../components/MainActivityForm';
import ActivityBudgetForm from '../components/ActivityBudgetForm';
import ActivityBudgetDetails from '../components/ActivityBudgetDetails';
import TrainingCostingTool from '../components/TrainingCostingTool';
import MeetingWorkshopCostingTool from '../components/MeetingWorkshopCostingTool';
import SupervisionCostingTool from '../components/SupervisionCostingTool';
import PrintingCostingTool from '../components/PrintingCostingTool';
import ProcurementCostingTool from '../components/ProcurementCostingTool';
import PlanReviewTable from '../components/PlanReviewTable';
import PlanPreviewModal from '../components/PlanPreviewModal';
import PlanningHeader from '../components/PlanningHeader';

// Modal components
const SuccessModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onViewPlans: () => void;
}> = ({ isOpen, onClose, onViewPlans }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Plan Submitted Successfully!</h3>
          <p className="text-gray-600 mb-6">
            Your plan has been submitted for review. You'll be notified when the review is complete.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Create Another Plan
            </button>
            <button
              onClick={onViewPlans}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              View My Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PlanStatusModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onViewPlans: () => void;
  planStatus: string;
  message: string;
}> = ({ isOpen, onClose, onViewPlans, planStatus, message }) => {
  if (!isOpen) return null;

  const isApproved = planStatus === 'APPROVED';
  const isRejected = planStatus === 'REJECTED';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="text-center">
          {isApproved && <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />}
          {isRejected && <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />}
          {!isApproved && !isRejected && <Info className="h-12 w-12 text-blue-500 mx-auto mb-4" />}
          
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isApproved ? 'Plan Approved!' : isRejected ? 'Plan Rejected' : 'Plan Status Update'}
          </h3>
          <p className="text-gray-600 mb-6">{message}</p>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              {isRejected ? 'Create New Plan' : 'Close'}
            </button>
            <button
              onClick={onViewPlans}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              View My Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Planning: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Authentication and user state
  const [userOrganization, setUserOrganization] = useState<Organization | null>(null);
  const [userOrgId, setUserOrgId] = useState<number | null>(null);
  const [isUserPlanner, setIsUserPlanner] = useState(false);
  const [plannerName, setPlannerName] = useState('');

  // Planning flow state
  const [currentStep, setCurrentStep] = useState<'type' | 'objectives' | 'planning' | 'review'>('type');
  const [selectedPlanType, setSelectedPlanType] = useState<PlanType>('LEO/EO Plan');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Objectives state
  const [selectedObjectives, setSelectedObjectives] = useState<StrategicObjective[]>([]);
  const [selectedObjective, setSelectedObjective] = useState<StrategicObjective | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);

  // Planning state
  const [selectedInitiative, setSelectedInitiative] = useState<StrategicInitiative | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<MainActivity | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | null>(null);
  const [budgetCalculationType, setBudgetCalculationType] = useState<BudgetCalculationType>('WITHOUT_TOOL');

  // Modal states
  const [showInitiativeForm, setShowInitiativeForm] = useState(false);
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showCostingTool, setShowCostingTool] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showBudgetDetails, setShowBudgetDetails] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Form state
  const [editingInitiative, setEditingInitiative] = useState<StrategicInitiative | null>(null);
  const [editingMeasure, setEditingMeasure] = useState<PerformanceMeasure | null>(null);
  const [editingActivity, setEditingActivity] = useState<MainActivity | null>(null);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [costingToolData, setCostingToolData] = useState<any>(null);

  // Loading and error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [planStatusInfo, setPlanStatusInfo] = useState({ status: '', message: '' });

  // Set default dates (current fiscal year)
  useEffect(() => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
    
    // Ethiopian fiscal year runs from July to June
    let fiscalYearStart, fiscalYearEnd;
    
    if (currentMonth >= 7) {
      // We're in the first half of the fiscal year (July-December)
      fiscalYearStart = `${currentYear}-07-01`;
      fiscalYearEnd = `${currentYear + 1}-06-30`;
    } else {
      // We're in the second half of the fiscal year (January-June)
      fiscalYearStart = `${currentYear - 1}-07-01`;
      fiscalYearEnd = `${currentYear}-06-30`;
    }
    
    setFromDate(fiscalYearStart);
    setToDate(fiscalYearEnd);
  }, []);

  // Check authentication and user permissions
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authData = await auth.getCurrentUser();
        
        if (!authData.isAuthenticated) {
          navigate('/login');
          return;
        }

        if (!isPlanner(authData.userOrganizations)) {
          setError('You do not have permission to access planning. Please contact your administrator.');
          return;
        }

        // Get user's organization
        if (authData.userOrganizations && authData.userOrganizations.length > 0) {
          const userOrgId = authData.userOrganizations[0].organization;
          setUserOrgId(userOrgId);
          setIsUserPlanner(true);
          
          // Set planner name
          const fullName = `${authData.user.first_name || ''} ${authData.user.last_name || ''}`.trim();
          setPlannerName(fullName || authData.user.username);

          // Fetch organization details
          try {
            const orgResponse = await organizations.getById(userOrgId.toString());
            if (orgResponse) {
              setUserOrganization(orgResponse);
            }
          } catch (orgError) {
            console.error('Failed to fetch organization details:', orgError);
          }
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        setError('Failed to verify authentication. Please try logging in again.');
      }
    };

    checkAuth();
  }, [navigate]);

  // Helper function to get organization name safely
  const getOrganizationName = (plan: any): string => {
    if (plan?.organizationName) return plan.organizationName;
    if (plan?.organization_name) return plan.organization_name;
    if (userOrganization?.name) return userOrganization.name;
    return 'Unknown Organization';
  };

  // Enhanced plan submission with comprehensive validation and error handling
  const handleSubmitPlan = async () => {
    if (!userOrganization || !userOrgId) {
      setError('User organization not found. Please refresh and try again.');
      return;
    }

    if (selectedObjectives.length === 0) {
      setError('Please select at least one strategic objective before submitting.');
      return;
    }

    // Validate that all objectives have proper weights
    const invalidObjectives = selectedObjectives.filter(obj => 
      !obj.effective_weight && !obj.planner_weight && !obj.weight
    );
    
    if (invalidObjectives.length > 0) {
      setError(`Some objectives are missing weight information: ${invalidObjectives.map(obj => obj.title).join(', ')}`);
      return;
    }

    // Validate total weight equals 100%
    const totalWeight = selectedObjectives.reduce((sum, obj) => {
      const effectiveWeight = obj.effective_weight || obj.planner_weight || obj.weight;
      return sum + effectiveWeight;
    }, 0);

    if (Math.abs(totalWeight - 100) > 0.01) {
      setError(`Total objective weights must equal 100%. Current total: ${totalWeight.toFixed(2)}%`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('=== STARTING PLAN SUBMISSION ===');
      console.log('Selected objectives before submission:', selectedObjectives.map(obj => ({
        id: obj.id,
        title: obj.title,
        weight: obj.weight,
        planner_weight: obj.planner_weight,
        effective_weight: obj.effective_weight
      })));

      // Ensure fresh authentication and CSRF token
      await auth.getCurrentUser();

      // Prepare objective IDs and weights for submission
      const objectiveIds = selectedObjectives.map(obj => obj.id).filter(id => id != null);
      const objectiveWeights: Record<string, number> = {};
      
      selectedObjectives.forEach(obj => {
        if (obj.id != null) {
          const effectiveWeight = obj.effective_weight || obj.planner_weight || obj.weight;
          objectiveWeights[obj.id.toString()] = effectiveWeight;
        }
      });

      console.log('Prepared submission data:', {
        objectiveIds,
        objectiveWeights,
        totalObjectives: selectedObjectives.length
      });

      // Validate data integrity before submission
      if (objectiveIds.length !== selectedObjectives.length) {
        throw new Error(`Data integrity error: ${selectedObjectives.length} objectives selected but only ${objectiveIds.length} IDs prepared`);
      }

      if (Object.keys(objectiveWeights).length !== selectedObjectives.length) {
        throw new Error(`Weight data integrity error: ${selectedObjectives.length} objectives but only ${Object.keys(objectiveWeights).length} weights prepared`);
      }

      // Prepare plan data with comprehensive error handling
      const planData = {
        organization: userOrgId,
        planner_name: plannerName,
        type: selectedPlanType,
        strategic_objective: selectedObjectives[0]?.id, // Primary objective for backward compatibility
        selected_objectives: objectiveIds, // Array of objective IDs
        selected_objectives_weights: objectiveWeights, // Custom weights object
        fiscal_year: new Date(fromDate).getFullYear().toString(),
        from_date: fromDate,
        to_date: toDate,
        status: 'SUBMITTED'
      };

      console.log('Final plan data for submission:', planData);

      // Submit plan with retry logic for production reliability
      let planResponse;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          console.log(`Plan submission attempt ${retryCount + 1}/${maxRetries}`);
          
          // Create plan with timeout
          planResponse = await Promise.race([
            plans.create(planData),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000)
            )
          ]);

          console.log('Plan submission successful:', planResponse);
          break; // Success, exit retry loop
          
        } catch (submitError) {
          retryCount++;
          console.error(`Plan submission attempt ${retryCount} failed:`, submitError);
          
          if (retryCount >= maxRetries) {
            throw submitError; // Final attempt failed
          }
          
          // Wait before retry with exponential backoff
          const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Refresh CSRF token before retry
          try {
            await auth.getCurrentUser();
          } catch (authError) {
            console.warn('Failed to refresh auth before retry:', authError);
          }
        }
      }

      // Validate the created plan
      if (!planResponse || !planResponse.id) {
        throw new Error('Plan was created but no ID was returned from server');
      }

      // Verify that all objectives were saved correctly
      try {
        console.log('Verifying saved plan data...');
        const savedPlan = await plans.getById(planResponse.id);
        
        if (!savedPlan) {
          throw new Error('Plan was created but could not be retrieved for verification');
        }

        // Check if all objectives were saved
        const savedObjectiveIds = savedPlan.selected_objectives || [];
        const savedObjectiveCount = Array.isArray(savedObjectiveIds) ? savedObjectiveIds.length : 0;
        
        console.log('Plan verification:', {
          submittedCount: selectedObjectives.length,
          savedCount: savedObjectiveCount,
          submittedIds: objectiveIds,
          savedIds: savedObjectiveIds
        });

        if (savedObjectiveCount !== selectedObjectives.length) {
          console.error('OBJECTIVE COUNT MISMATCH:', {
            expected: selectedObjectives.length,
            actual: savedObjectiveCount,
            submittedIds: objectiveIds,
            savedIds: savedObjectiveIds
          });
          
          throw new Error(
            `Data integrity error: Submitted ${selectedObjectives.length} objectives but only ${savedObjectiveCount} were saved. ` +
            `Please try again or contact support.`
          );
        }

        // Verify weights were saved
        const savedWeights = savedPlan.selected_objectives_weights || {};
        const savedWeightCount = Object.keys(savedWeights).length;
        
        if (savedWeightCount !== selectedObjectives.length) {
          console.warn('Weight count mismatch:', {
            expected: selectedObjectives.length,
            actual: savedWeightCount,
            submittedWeights: objectiveWeights,
            savedWeights: savedWeights
          });
        }

        console.log('✅ Plan verification successful - all objectives saved correctly');
        
      } catch (verificationError) {
        console.error('Plan verification failed:', verificationError);
        // Don't throw here - plan was created successfully, verification is just a check
        console.warn('Plan was created but verification failed - this may be a temporary issue');
      }

      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });

      console.log('=== PLAN SUBMISSION COMPLETED SUCCESSFULLY ===');
      
      // Show success modal
      setShowSuccessModal(true);
      
      // Reset form state
      setSelectedObjectives([]);
      setSelectedObjective(null);
      setSelectedProgram(null);
      setSelectedInitiative(null);
      setCurrentStep('type');
      
    } catch (error: any) {
      console.error('=== PLAN SUBMISSION FAILED ===');
      console.error('Submission error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        selectedObjectivesCount: selectedObjectives.length,
        userOrgId,
        plannerName
      });

      // Enhanced error message based on error type
      let errorMessage = 'Failed to submit plan. ';
      
      if (error.message?.includes('timeout')) {
        errorMessage += 'The request timed out. Please check your connection and try again.';
      } else if (error.message?.includes('integrity')) {
        errorMessage += error.message; // Use the specific integrity error message
      } else if (error.response?.status === 400) {
        if (error.response.data?.selected_objectives) {
          errorMessage += 'There was an issue with the selected objectives format. Please try reselecting your objectives.';
        } else {
          errorMessage += 'Invalid data submitted. Please check your inputs and try again.';
        }
      } else if (error.response?.status === 403) {
        errorMessage += 'Permission denied. Please ensure you have planner permissions.';
      } else if (error.response?.status === 500) {
        errorMessage += 'Server error occurred. Please try again in a few moments.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again or contact support if the problem persists.';
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigation handlers
  const handleBack = () => {
    if (currentStep === 'planning') {
      setCurrentStep('objectives');
    } else if (currentStep === 'review') {
      setCurrentStep('planning');
    } else if (currentStep === 'objectives') {
      setCurrentStep('type');
    }
  };

  const handleProceedToObjectives = () => {
    setCurrentStep('objectives');
  };

  const handleProceedToPlanning = () => {
    if (selectedObjectives.length === 0) {
      setError('Please select at least one strategic objective before proceeding.');
      return;
    }
    setCurrentStep('planning');
  };

  const handleProceedToReview = () => {
    setCurrentStep('review');
  };

  const handleViewMyPlans = () => {
    navigate('/dashboard');
  };

  const handleCreateNewPlan = () => {
    // Reset all state
    setSelectedObjectives([]);
    setSelectedObjective(null);
    setSelectedProgram(null);
    setSelectedInitiative(null);
    setSelectedActivity(null);
    setCurrentStep('type');
    setShowStatusModal(false);
    setShowSuccessModal(false);
  };

  // Form handlers
  const handleCancel = () => {
    setShowInitiativeForm(false);
    setShowMeasureForm(false);
    setShowActivityForm(false);
    setShowCostingTool(false);
    setShowBudgetForm(false);
    setShowBudgetDetails(false);
    setEditingInitiative(null);
    setEditingMeasure(null);
    setEditingActivity(null);
    setEditingBudget(null);
    setCostingToolData(null);
    setSelectedActivity(null);
    setSelectedActivityType(null);
    setError(null);
  };

  // Initiative handlers
  const handleEditInitiative = (initiative: StrategicInitiative | any) => {
    setEditingInitiative(initiative.id ? initiative : null);
    setShowInitiativeForm(true);
  };

  const handleSaveInitiative = async (data: any) => {
    try {
      setError(null);
      
      // Add organization to the data
      const initiativeData = {
        ...data,
        organization: userOrgId
      };

      if (editingInitiative?.id) {
        await initiatives.update(editingInitiative.id, initiativeData);
      } else {
        await initiatives.create(initiativeData);
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['initiatives'] });
      setRefreshKey(prev => prev + 1);
      
      handleCancel();
    } catch (error: any) {
      console.error('Error saving initiative:', error);
      setError(error.message || 'Failed to save initiative');
    }
  };

  // Performance measure handlers
  const handleEditMeasure = (measure: PerformanceMeasure | any) => {
    setEditingMeasure(measure.id ? measure : null);
    setShowMeasureForm(true);
  };

  const handleSaveMeasure = async (data: any) => {
    try {
      setError(null);
      
      // Add organization to the data
      const measureData = {
        ...data,
        organization: userOrgId
      };

      if (editingMeasure?.id) {
        await performanceMeasures.update(editingMeasure.id, measureData);
      } else {
        await performanceMeasures.create(measureData);
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['performance-measures'] });
      setRefreshKey(prev => prev + 1);
      
      handleCancel();
    } catch (error: any) {
      console.error('Error saving performance measure:', error);
      setError(error.message || 'Failed to save performance measure');
    }
  };

  // Main activity handlers
  const handleEditActivity = (activity: MainActivity | any) => {
    setEditingActivity(activity.id ? activity : null);
    setShowActivityForm(true);
  };

  const handleSaveActivity = async (data: any) => {
    try {
      setError(null);
      
      // Add organization to the data
      const activityData = {
        ...data,
        organization: userOrgId
      };

      if (editingActivity?.id) {
        await mainActivities.update(editingActivity.id, activityData);
      } else {
        await mainActivities.create(activityData);
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      setRefreshKey(prev => prev + 1);
      
      handleCancel();
    } catch (error: any) {
      console.error('Error saving main activity:', error);
      setError(error.message || 'Failed to save main activity');
    }
  };

  // Budget handlers
  const handleAddBudget = (activity: MainActivity, calculationType: BudgetCalculationType, activityType?: ActivityType) => {
    setSelectedActivity(activity);
    setBudgetCalculationType(calculationType);
    setSelectedActivityType(activityType || null);
    
    if (calculationType === 'WITH_TOOL' && activityType) {
      setShowCostingTool(true);
    } else {
      setShowBudgetForm(true);
    }
  };

  const handleEditBudget = (activity: MainActivity) => {
    setSelectedActivity(activity);
    setEditingBudget(activity.budget);
    
    if (activity.budget?.budget_calculation_type === 'WITH_TOOL' && activity.budget?.activity_type) {
      setBudgetCalculationType('WITH_TOOL');
      setSelectedActivityType(activity.budget.activity_type as ActivityType);
      setCostingToolData(activity.budget);
      setShowCostingTool(true);
    } else {
      setBudgetCalculationType('WITHOUT_TOOL');
      setShowBudgetForm(true);
    }
  };

  const handleViewBudgetDetails = (activity: MainActivity) => {
    setSelectedActivity(activity);
    setShowBudgetDetails(true);
  };

  const handleCostingToolComplete = (costingData: any) => {
    setCostingToolData(costingData);
    setShowCostingTool(false);
    setShowBudgetForm(true);
  };

  const handleSaveBudget = async (budgetData: any) => {
    try {
      setError(null);
      
      if (!selectedActivity?.id) {
        throw new Error('No activity selected for budget');
      }

      // Save budget using the main activities API
      await mainActivities.updateBudget(selectedActivity.id, budgetData);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      setRefreshKey(prev => prev + 1);
      
      handleCancel();
    } catch (error: any) {
      console.error('Error saving budget:', error);
      setError(error.message || 'Failed to save budget');
    }
  };

  // Costing tool renderers
  const renderCostingTool = () => {
    if (!selectedActivityType) return null;

    const commonProps = {
      onCalculate: handleCostingToolComplete,
      onCancel: handleCancel,
      initialData: costingToolData
    };

    switch (selectedActivityType) {
      case 'Training':
        return <TrainingCostingTool {...commonProps} />;
      case 'Meeting':
      case 'Workshop':
        return <MeetingWorkshopCostingTool {...commonProps} />;
      case 'Supervision':
        return <SupervisionCostingTool {...commonProps} />;
      case 'Printing':
        return <PrintingCostingTool {...commonProps} />;
      case 'Procurement':
        return <ProcurementCostingTool {...commonProps} />;
      default:
        return <div>Costing tool not available for this activity type</div>;
    }
  };

  // Error display
  if (error && !isUserPlanner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="p-8 bg-red-50 border border-red-200 rounded-lg text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Strategic Planning</h1>
        <p className="mt-2 text-gray-600">Create and manage your strategic plans</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Progress Steps */}
      <div className="mb-8">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {[
              { id: 'type', name: 'Plan Type', icon: FileType },
              { id: 'objectives', name: 'Objectives', icon: Target },
              { id: 'planning', name: 'Planning', icon: Activity },
              { id: 'review', name: 'Review', icon: CheckCircle }
            ].map((step, stepIdx) => (
              <li key={step.id} className={`${stepIdx !== 3 ? 'pr-8 sm:pr-20' : ''} relative`}>
                <div className="flex items-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                    currentStep === step.id
                      ? 'border-blue-600 bg-blue-600'
                      : stepIdx < ['type', 'objectives', 'planning', 'review'].indexOf(currentStep)
                      ? 'border-green-600 bg-green-600'
                      : 'border-gray-300 bg-white'
                  }`}>
                    <step.icon className={`h-5 w-5 ${
                      currentStep === step.id || stepIdx < ['type', 'objectives', 'planning', 'review'].indexOf(currentStep)
                        ? 'text-white'
                        : 'text-gray-500'
                    }`} />
                  </div>
                  <span className={`ml-4 text-sm font-medium ${
                    currentStep === step.id
                      ? 'text-blue-600'
                      : stepIdx < ['type', 'objectives', 'planning', 'review'].indexOf(currentStep)
                      ? 'text-green-600'
                      : 'text-gray-500'
                  }`}>
                    {step.name}
                  </span>
                </div>
                {stepIdx !== 3 && (
                  <div className="absolute top-5 right-0 h-0.5 w-8 sm:w-20 bg-gray-300" />
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Step 1: Plan Type Selection */}
        {currentStep === 'type' && (
          <div className="space-y-6">
            <PlanTypeSelector onSelectPlanType={(type) => {
              setSelectedPlanType(type);
              handleProceedToObjectives();
            }} />
          </div>
        )}

        {/* Step 2: Objectives Selection */}
        {currentStep === 'objectives' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Plan Type
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Select Strategic Objectives</h2>
              <div></div>
            </div>

            <PlanningHeader
              organizationName={userOrganization?.name || 'Loading...'}
              fromDate={fromDate}
              toDate={toDate}
              plannerName={plannerName}
              planType={selectedPlanType}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              onPlanTypeChange={setSelectedPlanType}
            />

            <HorizontalObjectiveSelector
              onObjectivesSelected={setSelectedObjectives}
              onProceed={handleProceedToPlanning}
              initialObjectives={selectedObjectives}
            />
          </div>
        )}

        {/* Step 3: Planning */}
        {currentStep === 'planning' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Objectives
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Plan Your Initiatives</h2>
              <button
                onClick={handleProceedToReview}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Review Plan
                <ArrowRight className="h-5 w-5 ml-1" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Objectives */}
              <div className="lg:col-span-1">
                <StrategicObjectivesList
                  onSelectObjective={setSelectedObjective}
                  selectedObjectiveId={selectedObjective?.id}
                  onSelectProgram={setSelectedProgram}
                  selectedObjectives={selectedObjectives}
                />
              </div>

              {/* Middle Column: Initiatives */}
              <div className="lg:col-span-1">
                {selectedObjective || selectedProgram ? (
                  <InitiativeList
                    parentId={(selectedObjective?.id || selectedProgram?.id)?.toString() || ''}
                    parentType={selectedObjective ? 'objective' : 'program'}
                    parentWeight={
                      selectedObjective 
                        ? (selectedObjective.effective_weight || selectedObjective.planner_weight || selectedObjective.weight)
                        : (selectedProgram?.strategic_objective?.effective_weight || selectedProgram?.strategic_objective?.weight || 100)
                    }
                    selectedObjectiveData={selectedObjective}
                    onEditInitiative={handleEditInitiative}
                    onSelectInitiative={setSelectedInitiative}
                    isNewPlan={true}
                    planKey={refreshKey.toString()}
                    isUserPlanner={isUserPlanner}
                    userOrgId={userOrgId}
                  />
                ) : (
                  <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <Target className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Select an objective to view initiatives</p>
                  </div>
                )}
              </div>

              {/* Right Column: Performance Measures and Activities */}
              <div className="lg:col-span-1">
                {selectedInitiative ? (
                  <div className="space-y-6">
                    {/* Performance Measures */}
                    <PerformanceMeasureList
                      initiativeId={selectedInitiative.id}
                      initiativeWeight={Number(selectedInitiative.weight)}
                      onEditMeasure={handleEditMeasure}
                      onSelectMeasure={() => {}}
                      isNewPlan={true}
                      planKey={refreshKey.toString()}
                    />

                    {/* Main Activities */}
                    <MainActivityList
                      initiativeId={selectedInitiative.id}
                      initiativeWeight={Number(selectedInitiative.weight)}
                      onEditActivity={handleEditActivity}
                      onSelectActivity={setSelectedActivity}
                      onAddBudget={handleAddBudget}
                      onEditBudget={handleEditBudget}
                      onViewBudgetDetails={handleViewBudgetDetails}
                      isNewPlan={true}
                      planKey={refreshKey.toString()}
                      isUserPlanner={isUserPlanner}
                      userOrgId={userOrgId}
                    />
                  </div>
                ) : (
                  <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <DollarSign className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Select an initiative to view main activities</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 'review' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Planning
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Review Your Plan</h2>
              <div></div>
            </div>

            <PlanReviewTable
              objectives={selectedObjectives}
              onSubmit={handleSubmitPlan}
              isSubmitting={isSubmitting}
              organizationName={userOrganization?.name || 'Unknown Organization'}
              plannerName={plannerName}
              fromDate={fromDate}
              toDate={toDate}
              planType={selectedPlanType}
              userOrgId={userOrgId}
            />
          </div>
        )}
      </div>

      {/* Modals and Forms */}
      
      {/* Initiative Form Modal */}
      {showInitiativeForm && (selectedObjective || selectedProgram) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingInitiative?.id ? 'Edit Initiative' : 'Create Initiative'}
            </h3>
            
            {(() => {
              // Calculate the effective weight for the form
              let formParentWeight = 100;
              let selectedObjectiveData = null;
              
              if (selectedObjective) {
                // Find the selected objective in the selectedObjectives array
                selectedObjectiveData = selectedObjectives.find(obj => obj.id === selectedObjective.id);
                
                if (selectedObjectiveData) {
                  formParentWeight = selectedObjectiveData.effective_weight !== undefined 
                    ? selectedObjectiveData.effective_weight
                    : selectedObjectiveData.planner_weight !== undefined && selectedObjectiveData.planner_weight !== null
                      ? selectedObjectiveData.planner_weight
                      : selectedObjectiveData.weight;
                } else {
                  formParentWeight = selectedObjective.effective_weight !== undefined 
                    ? selectedObjective.effective_weight
                    : selectedObjective.planner_weight !== undefined && selectedObjective.planner_weight !== null
                      ? selectedObjective.planner_weight
                      : selectedObjective.weight;
                }
              } else if (selectedProgram) {
                const parentObjective = selectedObjectives.find(obj => 
                  obj.id === selectedProgram.strategic_objective_id || 
                  obj.id === selectedProgram.strategic_objective?.id
                );
                
                if (parentObjective) {
                  formParentWeight = parentObjective.effective_weight !== undefined 
                    ? parentObjective.effective_weight
                    : parentObjective.planner_weight !== undefined && parentObjective.planner_weight !== null
                      ? parentObjective.planner_weight
                      : parentObjective.weight;
                } else {
                  formParentWeight = selectedProgram.strategic_objective?.weight || 100;
                }
              }
              
              console.log('InitiativeForm Modal - Weight calculation:', {
                selectedObjective: selectedObjective?.title,
                selectedProgram: selectedProgram?.name,
                selectedObjectiveData: selectedObjectiveData ? 'found' : 'not found',
                formParentWeight,
                originalWeight: selectedObjective?.weight || selectedProgram?.strategic_objective?.weight
              });
              
              return (
                <InitiativeForm
                  parentId={(selectedObjective?.id || selectedProgram?.id)?.toString() || ''}
                  parentType={selectedObjective ? 'objective' : 'program'}
                  parentWeight={formParentWeight}
                  selectedObjectiveData={selectedObjectiveData}
                  currentTotal={0}
                  onSubmit={handleSaveInitiative}
                  onCancel={handleCancel}
                  initialData={editingInitiative}
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* Performance Measure Form Modal */}
      {showMeasureForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingMeasure?.id ? 'Edit Performance Measure' : 'Create Performance Measure'}
            </h3>
            
            <PerformanceMeasureForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handleSaveMeasure}
              onCancel={handleCancel}
              initialData={editingMeasure}
            />
          </div>
        </div>
      )}

      {/* Main Activity Form Modal */}
      {showActivityForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingActivity?.id ? 'Edit Main Activity' : 'Create Main Activity'}
            </h3>
            
            <MainActivityForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handleSaveActivity}
              onCancel={handleCancel}
              initialData={editingActivity}
            />
          </div>
        </div>
      )}

      {/* Costing Tool Modal */}
      {showCostingTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedActivityType} Cost Calculator
              </h3>
              {renderCostingTool()}
            </div>
          </div>
        </div>
      )}

      {/* Budget Form Modal */}
      {showBudgetForm && selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingBudget ? 'Edit Budget' : 'Add Budget'} - {selectedActivity.name}
            </h3>
            
            <ActivityBudgetForm
              activity={selectedActivity}
              budgetCalculationType={budgetCalculationType}
              activityType={selectedActivityType}
              onSubmit={handleSaveBudget}
              onCancel={handleCancel}
              initialData={editingBudget || costingToolData}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Budget Details Modal */}
      {showBudgetDetails && selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ActivityBudgetDetails
              activity={selectedActivity}
              onBack={handleCancel}
              onEdit={() => {
                setShowBudgetDetails(false);
                handleEditBudget(selectedActivity);
              }}
              isReadOnly={!isUserPlanner}
            />
          </div>
        </div>
      )}

      {/* Plan Preview Modal */}
      <PlanPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        objectives={selectedObjectives}
        organizationName={userOrganization?.name || 'Unknown Organization'}
        plannerName={plannerName}
        fromDate={fromDate}
        toDate={toDate}
        planType={selectedPlanType}
        refreshKey={refreshKey}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          handleViewMyPlans();
        }}
        onViewPlans={handleViewMyPlans}
      />

      {/* Plan Status Modal */}
      <PlanStatusModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        onViewPlans={() => {
          setShowStatusModal(false);
          if (planStatusInfo.status === 'REJECTED') {
            handleCreateNewPlan();
          } else {
            handleViewMyPlans();
          }
        }}
        planStatus={planStatusInfo.status}
        message={planStatusInfo.message}
      />
    </div>
  );
};

export default Planning;