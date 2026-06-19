use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
use futures_util::future::{Ready, ready};
use std::future::{ready, Ready};
use std::rc::Rc;
use crate::error::{authorization_error, AppError};

pub struct RequireRole {
    allowed_roles: Vec<String>,
}

impl RequireRole {
    pub fn new(allowed_roles: Vec<&str>) -> Self {
        RequireRole {
            allowed_roles: allowed_roles.iter().map(|s| s.to_string()).collect(),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RequireRole
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RequireRoleService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequireRoleService {
            service: Rc::new(service),
            allowed_roles: self.allowed_roles.clone(),
        }))
    }
}

pub struct RequireRoleService<S> {
    service: Rc<S>,
    allowed_roles: Vec<String>,
}

impl<S, B> Service<ServiceRequest> for RequireRoleService<S>
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
        let allowed_roles = self.allowed_roles.clone();
        
        Box::pin(async move {
            // Extract user role from request extensions (set by auth middleware)
            let user_role = req
                .extensions()
                .get::<String>()
                .and_then(|role| Some(role.clone()))
                .unwrap_or_else(|| "".to_string());

            if !allowed_roles.contains(&user_role) {
                return Err(authorization_error(
                    &format!("User role '{}' not authorized. Required roles: {:?}", 
                             user_role, allowed_roles)
                ).into());
            }

            service.call(req).await
        })
    }
}
