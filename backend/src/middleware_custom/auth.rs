use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
use futures_util::future::{Ready, ready};
use std::future::{ready, Ready};
use std::rc::Rc;
use crate::auth::AuthService;
use crate::error::{auth_error, AppError};

pub struct Authentication;

impl<S, B> Transform<S, ServiceRequest> for Authentication
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = AuthenticationService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthenticationService {
            service: Rc::new(service),
        }))
    }
}

pub struct AuthenticationService<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for AuthenticationService<S>
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
            // Extract Authorization header
            let auth_header = req
                .headers()
                .get("Authorization")
                .and_then(|h| h.to_str().ok());

            if let Some(auth_header) = auth_header {
                if auth_header.starts_with("Bearer ") {
                    let token = &auth_header[7..];
                    
                    // In a real implementation, you would verify the token here
                    // For now, we'll just check if it's not empty
                    if token.is_empty() {
                        return Err(auth_error("Invalid authentication token").into());
                    }
                    
                    // Store user info in request extensions
                    // This would normally come from JWT verification
                    req.extensions_mut().insert("user_id".to_string());
                    req.extensions_mut().insert("role".to_string());
                } else {
                    return Err(auth_error("Invalid authorization header format").into());
                }
            } else {
                return Err(auth_error("Missing authorization header").into());
            }

            service.call(req).await
        })
    }
}
