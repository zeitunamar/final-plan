from rest_framework import serializers
from .models import (
    Organization, OrganizationUser, StrategicObjective, 
    Program, StrategicInitiative, PerformanceMeasure, MainActivity,
    ActivityBudget, ActivityCostingAssumption, Plan, PlanReview, InitiativeFeed,
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
    
    class Meta:
        model = ActivityBudget
        fields = '__all__'
    
    def get_total_funding(self, obj):
        return obj.total_funding
    
    def get_estimated_cost(self, obj):
        return obj.estimated_cost
    
    def get_funding_gap(self, obj):
        return obj.funding_gap

class MainActivitySerializer(serializers.ModelSerializer):
    initiative_name = serializers.CharField(source='initiative.name', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    budget = ActivityBudgetSerializer(read_only=True)
    
    class Meta:
        model = MainActivity
        fields = '__all__'

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
    
    class Meta:
        model = Plan
        fields = '__all__'

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