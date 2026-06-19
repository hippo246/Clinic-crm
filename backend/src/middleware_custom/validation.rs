use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, web,
};
use futures_util::future::{Ready, ready};
use std::future::{ready, Ready};
use std::rc::Rc;
use validator::Validate;
use crate::error::{validation_error, AppError};

pub struct Validation;

impl<S, B> Transform<S, ServiceRequest> for Validation
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = ValidationService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(ValidationService {
            service: Rc::new(service),
        }))
    }
}

pub struct ValidationService<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for ValidationService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = futures_util::future::LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        
        Box::pin(async move {
            // Validate request body if present
            // This is a simplified version - in production, you'd extract and validate specific types
            service.call(req).await
        })
    }
}

// Helper function to validate request payloads
pub fn validate_payload<T: Validate>(payload: &T) -> Result<(), AppError> {
    payload.validate()
        .map_err(|e| validation_error(&format!("Validation failed: {}", e)))
}

// SQL injection prevention middleware
pub struct SqlInjectionProtection;

impl<S, B> Transform<S, ServiceRequest> for SqlInjectionProtection
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = SqlInjectionProtectionService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(SqlInjectionProtectionService {
            service: Rc::new(service),
        }))
    }
}

pub struct SqlInjectionProtectionService<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for SqlInjectionProtectionService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = futures_util::future::LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        
        Box::pin(async move {
            // Check query parameters for SQL injection patterns
            let query_string = req.query_string();
            
            let dangerous_patterns = [
                "--", ";", "/*", "*/", "xp_", "sp_", "DROP", "DELETE", 
                "TRUNCATE", "ALTER", "EXEC", "UNION", "SELECT", "INSERT",
                "UPDATE", "WHERE", "OR", "AND"
            ];
            
            let upper_query = query_string.to_uppercase();
            if dangerous_patterns.iter().any(|pattern| upper_query.contains(pattern)) {
                return Err(validation_error("Potential SQL injection detected").into());
            }
            
            service.call(req).await
        })
    }
}
