/**
 * Reusable generic form hook
 * Manages form state, validation, and submission
 */

import { useState, useCallback, useRef } from "react";
import type {
  FormErrors,
  FormTouched,
  ValidatorFn,
  FormValidator,
  FormHandler,
  FormConfig,
} from "../types/form.types";

/**
 * Generic form hook
 */
export function useForm<T extends Record<string, unknown>>(config: FormConfig<T>): FormHandler<T> {
  const { initialValues, validators, validateOnChange = false, validateOnBlur = true } = config;

  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [touched, setTouched] = useState<FormTouched<T>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const initialValuesRef = useRef(initialValues);

  /**
   * Check if form is dirty (values differ from initial)
   */
  const dirty = JSON.stringify(values) !== JSON.stringify(initialValuesRef.current);

  /**
   * Set a single field value
   */
  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValuesState((prev) => ({ ...prev, [field]: value }));
    
    // Validate on change if enabled
    if (validateOnChange && validators?.[field]) {
      const validator = validators[field] as ValidatorFn<T[K]>;
      const error = validator(value, values);
      setErrors((prev) => ({ ...prev, [field]: error || undefined }));
    }
  }, [validateOnChange, validators, values]);

  /**
   * Set multiple field values
   */
  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }));
  }, []);

  /**
   * Handle field change
   */
  const handleChange = useCallback(<K extends keyof T>(field: K) => {
    return (value: T[K]) => {
      setValue(field, value);
    };
  }, [setValue]);

  /**
   * Handle field blur
   */
  const handleBlur = useCallback(<K extends keyof T>(field: K) => {
    return () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      
      // Validate on blur if enabled
      if (validateOnBlur && validators?.[field]) {
        const validator = validators[field] as ValidatorFn<T[K]>;
        const error = validator(values[field], values);
        setErrors((prev) => ({ ...prev, [field]: error || undefined }));
      }
    };
  }, [validateOnBlur, validators, values]);

  /**
   * Validate all fields
   */
  const validate = useCallback(() => {
    const newErrors: FormErrors<T> = {};
    let isValid = true;

    if (validators) {
      Object.keys(validators).forEach((key) => {
        const field = key as keyof T;
        const validator = validators[field] as ValidatorFn<T[keyof T]>;
        const error = validator(values[field], values);
        if (error) {
          newErrors[field] = error;
          isValid = false;
        }
      });
    }

    setErrors(newErrors);
    return isValid;
  }, [validators, values]);

  /**
   * Reset form to initial values
   */
  const reset = useCallback(() => {
    setValuesState(initialValuesRef.current);
    setErrors({});
    setTouched({});
    setSuccess(false);
    setError(null);
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async (onSubmit: (values: T) => void | Promise<void>) => {
    return async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      // Validate all fields
      const isValid = validate();
      if (!isValid) {
        return;
      }

      setSubmitting(true);
      setError(null);
      setSuccess(false);

      try {
        await onSubmit(values);
        setSuccess(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
      } finally {
        setSubmitting(false);
      }
    };
  }, [validate, values]);

  /**
   * Set submitting state
   */
  const setSubmittingState = useCallback((submitting: boolean) => {
    setSubmitting(submitting);
  }, []);

  /**
   * Set success state
   */
  const setSuccessState = useCallback((success: boolean) => {
    setSuccess(success);
  }, []);

  /**
   * Set error state
   */
  const setErrorState = useCallback((error: string | null) => {
    setError(error);
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    values,
    errors,
    touched,
    dirty,
    submitting,
    success,
    error,
    setValue,
    setValues,
    handleChange,
    handleBlur,
    validate,
    reset,
    handleSubmit,
    setSubmitting: setSubmittingState,
    setSuccess: setSuccessState,
    setError: setErrorState,
    clearError,
  };
}
