# backend api

This backend supports an application allowing users to steer on an LLM using Goodfire's Ember SDK.

- variants
- conversations 
- features 

variants have specific features associated with them (modified ones)
conversations have specific features associated with them (activated ones)

user can switch between variants in a conversation


Conversation
- id
- currentVariant: Variant
- activatedFeatures: List of FeatureActivation # cached

Variant
- id
- name: str
- modifiedFeatures: Dict[str, float]
- pendingFeatures: Dict[str, float]

Feature (stateless, same as Ember SDK)
- uuid: UUID
- label: str
- activation: int


API response DTO
class Feature:
    uuid: str
    label: str
    activation: float
    modification: float
    pendingModification: float

## user flows
- create a new conversation
- create new variant
- send message, receive response
- steer on a feature
- see comparison of original and modified response
- confirm modification
- send message, receive response


POST /conversation/create (create)
GET /conversation/{id} (fetch)
POST /conversation/{id}/messages (send message)

GET /conversations/{id}/features (fetch features)

POST/variants (create)
GET /variant/{id} (fetch)
DELETE /variant/{id} (delete)
POST /conversations/{id}/switch-variant (switch variant)

POST /variants/{id}/features/{uuid}/steer (steer feature)
POST /variants/{id}/commit-changes (confirm pending)
POST /variants/{id}/reject-changes (reject pending)
DELETE /variants/{id}/modifications (clear modifications)
