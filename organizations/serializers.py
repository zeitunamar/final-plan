from rest_framework import serializers
from django.db import transaction
from .models import (
    Organization, OrganizationUser, StrategicObjective, 
    Program, StrategicInitiative, PerformanceMeasure, MainActivity,
    ActivityBudget, SubActivity, ActivityCostingAssumption, Plan, PlanReview, InitiativeFeed,
    Location, LandTransport, AirTransport, PerDiem, Accommodation,
    ParticipantCost, SessionCost, PrintingCost, SupervisorCost, ProcurementItem
)

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = '__all__'

class OrganizationUserSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    
    class Meta:
        model = OrganizationUser
        fields = '__all__'

class StrategicObjectiveSerializer(serializers.ModelSerializer):
    effective_weight = serializers.SerializerMethodField()
    
    class Meta:
        model = StrategicObjective
        fields = '__all__'
    
    def get_effective_weight(self, obj):
        return obj.get_effective_weight()

class ProgramSerializer(serializers.ModelSerializer):
    strategic_objective_title = serializers.CharField(source='strategic_objective.title', read_only=True)
    
    class Meta:
        model = Program
        fields = '__all__'

class StrategicInitiativeSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    strategic_objective_title = serializers.CharField(source='strategic_objective.title', read_only=True)
    program_name = serializers.CharField(source='program.name', read_only=True)
    initiative_feed_name = serializers.CharField(source='initiative_feed.name', read_only=True)
    
    class Meta:
        model = StrategicInitiative
        fields = '__all__'

class PerformanceMeasureSerializer(serializers.ModelSerializer):
    initiative_name = serializers.CharField(source='initiative.name', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    
    class Meta:
        model = PerformanceMeasure
        fields = '__all__'

class ActivityBudgetSerializer(serializers.ModelSerializer):
    total_funding = serializers.SerializerMethodField()
    estimated_cost = serializers.SerializerMethodField()
    funding_gap = serializers.SerializerMethodField()
    sub_activity_name = serializers.CharField(source='sub_activity.name', read_only=True)
    sub_activity_type = serializers.CharField(source='sub_activity.activity_type', read_only=True)
    
    class Meta:
        model = ActivityBudget
        fields = '__all__'
    
    def get_total_funding(self, obj):
        return obj.total_funding
    
    def get_estimated_cost(self, obj):
        return obj.estimated_cost
    
    def get_funding_gap(self, obj):
        return obj.funding_gap

class SubActivitySerializer(serializers.ModelSerializer):
    budget = ActivityBudgetSerializer(read_only=True)
    main_activity_name = serializers.CharField(source='main_activity.name', read_only=True)
    
    class Meta:
        model = SubActivity
        fields = '__all__'
class MainActivitySerializer(serializers.ModelSerializer):
    initiative_name = serializers.CharField(source='initiative.name', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    sub_activities = SubActivitySerializer(many=True, read_only=True)
    total_budget = serializers.SerializerMethodField()
    total_funding = serializers.SerializerMethodField()
    funding_gap = serializers.SerializerMethodField()
    # Keep legacy budget field for backward compatibility
    budget = ActivityBudgetSerializer(read_only=True, source='legacy_budgets.first')
    
    class Meta:
        model = MainActivity
        fields = '__all__'
    
    def get_total_budget(self, obj):
        return obj.total_budget
    
    def get_total_funding(self, obj):
        return obj.total_funding
    
    def get_funding_gap(self, obj):
        return obj.funding_gap

class ActivityCostingAssumptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityCostingAssumption
        fields = '__all__'

class PlanReviewSerializer(serializers.ModelSerializer):
    evaluator_name = serializers.CharField(source='evaluator.user.username', read_only=True)
    
    class Meta:
        model = PlanReview
        fields = '__all__'

class PlanSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    strategic_objective_title = serializers.CharField(source='strategic_objective.title', read_only=True)
    program_name = serializers.CharField(source='program.name', read_only=True)
    reviews = PlanReviewSerializer(many=True, read_only=True)
    selected_objectives_data = serializers.SerializerMethodField()
    objectives = serializers.SerializerMethodField()
    
    class Meta:
        model = Plan
        fields = '__all__'
    
    def get_selected_objectives_data(self, obj):
        """Get complete data for all selected objectives with their custom weights"""
        try:
            selected_objectives = obj.selected_objectives.all()
            objectives_data = []
            
            for objective in selected_objectives:
                # Get custom weight from selected_objectives_weights if available
                custom_weight = None
                if obj.selected_objectives_weights and str(objective.id) in obj.selected_objectives_weights:
                    custom_weight = obj.selected_objectives_weights[str(objective.id)]
                
                # Get effective weight (custom weight if set, otherwise original weight)
                effective_weight = custom_weight if custom_weight is not None else objective.weight
                
                # Get initiatives for this objective - ONLY show planner's organization initiatives
                from django.db import models
                initiatives = objective.initiatives.filter(
                    models.Q(is_default=True) | 
                    models.Q(organization=obj.organization)
                ).exclude(
                    models.Q(organization__isnull=False) & ~models.Q(organization=obj.organization)
                )
                
                initiatives_data = []
                for initiative in initiatives:
                    # Get performance measures - ONLY from planner's organization
                    measures = initiative.performance_measures.filter(
                        models.Q(organization=obj.organization)
                    ).exclude(
                        models.Q(organization__isnull=False) & ~models.Q(organization=obj.organization)
                    )
                    
                    # Get main activities - ONLY from planner's organization
                    activities = initiative.main_activities.filter(
                        models.Q(organization=obj.organization)
                    ).exclude(
                        models.Q(organization__isnull=False) & ~models.Q(organization=obj.organization)
                    )
                    
                    initiatives_data.append({
                        'id': initiative.id,
                        'name': initiative.name,
                        'weight': float(initiative.weight),
                        'organization_name': initiative.organization.name if initiative.organization else None,
                        'performance_measures': PerformanceMeasureSerializer(measures, many=True).data,
                        'main_activities': MainActivitySerializer(activities, many=True).data
                    })
                
                objectives_data.append({
                    'id': objective.id,
                    'title': objective.title,
                    'description': objective.description,
                    'weight': float(objective.weight),
                    'planner_weight': float(custom_weight) if custom_weight is not None else None,
                    'effective_weight': float(effective_weight),
                    'is_default': objective.is_default,
                    'initiatives': initiatives_data
                })
            
            return objectives_data
        except Exception as e:
            print(f"Error in get_selected_objectives_data: {str(e)}")
            return []
    
    def get_objectives(self, obj):
        """Alias for selected_objectives_data for backward compatibility"""
        return self.get_selected_objectives_data(obj)
    
    def create(self, validated_data):
        """Override create to handle selected objectives and their weights"""
        try:
            with transaction.atomic():
                # Extract selected objectives data if provided
                selected_objectives_data = validated_data.pop('selected_objectives', [])
                selected_objectives_weights = validated_data.pop('selected_objectives_weights', {})
                
                # Create the plan
                plan = Plan.objects.create(**validated_data)
                
                # Add selected objectives if provided
                if selected_objectives_data:
                    # Handle both list of IDs and list of objects
                    if isinstance(selected_objectives_data, list):
                        if selected_objectives_data and isinstance(selected_objectives_data[0], dict):
                            # List of objects with 'id' field
                            objective_ids = [obj['id'] for obj in selected_objectives_data if 'id' in obj]
                        else:
                            # List of IDs
                            objective_ids = selected_objectives_data
                    else:
                        objective_ids = []
                    
                    if objective_ids:
                        plan.selected_objectives.set(objective_ids)
                
                # Save custom weights if provided
                if selected_objectives_weights:
                    plan.selected_objectives_weights = selected_objectives_weights
                    plan.save()
                
                return plan
        except Exception as e:
            print(f"Error creating plan: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            raise serializers.ValidationError(f"Failed to create plan: {str(e)}")
    
    def update(self, instance, validated_data):
        """Override update to handle selected objectives and their weights"""
        try:
            with transaction.atomic():
                # Extract selected objectives data if provided
                selected_objectives_data = validated_data.pop('selected_objectives', [])
                selected_objectives_weights = validated_data.pop('selected_objectives_weights', {})
                
                # Update the plan fields
                for attr, value in validated_data.items():
                    setattr(instance, attr, value)
                
                # Update selected objectives if provided
                if selected_objectives_data:
                    # Handle both list of IDs and list of objects
                    if isinstance(selected_objectives_data, list):
                        if selected_objectives_data and isinstance(selected_objectives_data[0], dict):
                            # List of objects with 'id' field
                            objective_ids = [obj['id'] for obj in selected_objectives_data if 'id' in obj]
                        else:
                            # List of IDs
                            objective_ids = selected_objectives_data
                    else:
                        objective_ids = []
                    
                    if objective_ids:
                        instance.selected_objectives.set(objective_ids)
                
                # Update custom weights if provided
                if selected_objectives_weights:
                    instance.selected_objectives_weights = selected_objectives_weights
                    
                instance.save()
                
                return instance
        except Exception as e:
            print(f"Error updating plan: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            raise serializers.ValidationError(f"Failed to update plan: {str(e)}")

class InitiativeFeedSerializer(serializers.ModelSerializer):
    strategic_objective_title = serializers.CharField(source='strategic_objective.title', read_only=True)
    
    class Meta:
        model = InitiativeFeed
        fields = '__all__'

# Location-related serializers
class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'

class LandTransportSerializer(serializers.ModelSerializer):
    origin_name = serializers.CharField(source='origin.name', read_only=True)
    destination_name = serializers.CharField(source='destination.name', read_only=True)
    
    class Meta:
        model = LandTransport
        fields = '__all__'

class AirTransportSerializer(serializers.ModelSerializer):
    origin_name = serializers.CharField(source='origin.name', read_only=True)
    destination_name = serializers.CharField(source='destination.name', read_only=True)
    
    class Meta:
        model = AirTransport
        fields = '__all__'

class PerDiemSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)
    
    class Meta:
        model = PerDiem
        fields = '__all__'

class AccommodationSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)
    service_type_display = serializers.CharField(source='get_service_type_display', read_only=True)
    
    class Meta:
        model = Accommodation
        fields = '__all__'

class ParticipantCostSerializer(serializers.ModelSerializer):
    cost_type_display = serializers.CharField(source='get_cost_type_display', read_only=True)
    
    class Meta:
        model = ParticipantCost
        fields = '__all__'

class SessionCostSerializer(serializers.ModelSerializer):
    cost_type_display = serializers.CharField(source='get_cost_type_display', read_only=True)
    
    class Meta:
        model = SessionCost
        fields = '__all__'

class PrintingCostSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    
    class Meta:
        model = PrintingCost
        fields = '__all__'

class SupervisorCostSerializer(serializers.ModelSerializer):
    cost_type_display = serializers.CharField(source='get_cost_type_display', read_only=True)
    
    class Meta:
        model = SupervisorCost
        fields = '__all__'

class ProcurementItemSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    unit_display = serializers.CharField(source='get_unit_display', read_only=True)
    
    class Meta:
        model = ProcurementItem
        fields = '__all__'