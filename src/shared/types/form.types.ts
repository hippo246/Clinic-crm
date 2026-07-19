/**
 * Reusable form types
 * Generic types for form handling
 */

/**
 * Field error type
 */
export interface FieldError {
  message: string;
  type?: string;
}

/**
 * Form errors type - maps field names to errors
 */
export type FormErrors<T> = Partial<Record<keyof T, FieldError | string>>;

/**
 * Form touched fields type - maps field names to boolean
 */
export type FormTouched<T> = Partial<Record<keyof T, boolean>>;

/**
 * Validator function type
 */
export type ValidatorFn<T> = (value: T, formValues?: T) => FieldError | string | null | undefined;

/**
 * Form validator type - maps field names to validator functions
 */
export type FormValidator<T> = Partial<Record<keyof T, ValidatorFn<T[keyof T]>>>;

/**
 * Submit state type
 */
export interface SubmitState {
  submitting: boolean;
  success: boolean;
  error: string | null;
}

/**
 * Form field type options
 */
export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "phone"
  | "number"
  | "date"
  | "datetime-local"
  | "time"
  | "select"
  | "textarea"
  | "checkbox"
  | "radio"
  | "password"
  | "hidden";

/**
 * Form field option for select/radio
 */
export interface FormFieldOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

/**
 * Form field props base interface
 */
export interface BaseFormFieldProps {
  name: string;
  label?: string;
  type?: FormFieldType;
  value?: unknown;
  onChange?: (value: unknown) => void;
  onBlur?: () => void;
  error?: string | FieldError;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: FormFieldOption[];
  rows?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  autoComplete?: string;
  disabledReason?: string;
}

/**
 * Form handler return type
 */
export interface FormHandler<T> {
  values: T;
  errors: FormErrors<T>;
  touched: FormTouched<T>;
  dirty: boolean;
  submitting: boolean;
  success: boolean;
  error: string | null;
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (values: Partial<T>) => void;
  handleChange: <K extends keyof T>(field: K) => (value: T[K]) => void;
  handleBlur: <K extends keyof T>(field: K) => () => void;
  validate: () => boolean;
  reset: () => void;
  handleSubmit: (onSubmit: (values: T) => void | Promise<void>) => (e?: React.FormEvent) => Promise<void>;
  setSubmitting: (submitting: boolean) => void;
  setSuccess: (success: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * Form config options
 */
export interface FormConfig<T> {
  initialValues: T;
  validators?: FormValidator<T>;
  onSubmit?: (values: T) => void | Promise<void>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}
