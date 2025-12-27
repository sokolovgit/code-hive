import { readFileSync } from 'fs';
import * as os from 'os';
import { join } from 'path';

import {
  Resource,
  resourceFromAttributes,
  detectResources,
  envDetector,
  hostDetector,
  osDetector,
  processDetector,
  serviceInstanceIdDetector,
} from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_INSTANCE_ID,
  SEMRESATTRS_PROCESS_COMMAND_LINE,
  SEMRESATTRS_PROCESS_RUNTIME_NAME,
  SEMRESATTRS_PROCESS_RUNTIME_VERSION,
} from '@opentelemetry/semantic-conventions';

import { Environments } from '../../enums';

export interface ResourceFactoryOptions {
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  serviceInstanceId?: string;
  additionalAttributes?: Record<string, string | number | boolean>;
  detectors?: Array<() => Promise<Resource> | Resource>;
  attributes?: Record<string, string | number | boolean>; // Alias for additionalAttributes
}

/**
 * Creates an OpenTelemetry Resource with automatic detection
 * and custom attributes
 */
export function createResource(options: ResourceFactoryOptions = {}): Resource {
  const {
    serviceName,
    serviceVersion,
    environment,
    serviceInstanceId,
    additionalAttributes = {},
    attributes = {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    detectors = [],
  } = options;

  // Merge additionalAttributes and attributes
  const allAdditionalAttributes = { ...additionalAttributes, ...attributes };

  // Build base resource attributes
  const resourceAttributes: Record<string, string | number | boolean> = {
    ...allAdditionalAttributes,
  };

  // Service name
  if (serviceName) {
    resourceAttributes[SEMRESATTRS_SERVICE_NAME] = serviceName;
  } else {
    // Try to read from package.json
    try {
      const packagePath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      resourceAttributes[SEMRESATTRS_SERVICE_NAME] =
        packageJson.name || process.env.APP_NAME || 'nestjs-app';
    } catch {
      resourceAttributes[SEMRESATTRS_SERVICE_NAME] = process.env.APP_NAME || 'nestjs-app';
    }
  }

  // Service version
  if (serviceVersion) {
    resourceAttributes[SEMRESATTRS_SERVICE_VERSION] = serviceVersion;
  } else {
    // Try to read from package.json
    try {
      const packagePath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      resourceAttributes[SEMRESATTRS_SERVICE_VERSION] =
        packageJson.version || process.env.APP_VERSION || 'unknown';
    } catch {
      resourceAttributes[SEMRESATTRS_SERVICE_VERSION] = process.env.APP_VERSION || 'unknown';
    }
  }

  // Environment
  if (environment) {
    resourceAttributes[SEMRESATTRS_DEPLOYMENT_ENVIRONMENT] = environment;
  } else {
    resourceAttributes[SEMRESATTRS_DEPLOYMENT_ENVIRONMENT] =
      process.env.NODE_ENV || Environments.DEVELOPMENT;
  }

  // Service instance ID
  if (serviceInstanceId) {
    resourceAttributes[SEMRESATTRS_SERVICE_INSTANCE_ID] = serviceInstanceId;
  } else {
    // Generate a unique instance ID
    resourceAttributes[SEMRESATTRS_SERVICE_INSTANCE_ID] =
      process.env.OTEL_SERVICE_INSTANCE_ID || `${os.hostname()}-${process.pid}`;
  }

  // Host name
  resourceAttributes['host.name'] = os.hostname();

  // OS information
  resourceAttributes['os.type'] = os.type();
  resourceAttributes['os.description'] = `${os.type()} ${os.release()}`;

  // Process information
  resourceAttributes['process.pid'] = process.pid;
  resourceAttributes['process.command'] = process.argv[1] || '';
  resourceAttributes[SEMRESATTRS_PROCESS_COMMAND_LINE] = process.argv.join(' ');
  resourceAttributes[SEMRESATTRS_PROCESS_RUNTIME_NAME] = 'nodejs';
  resourceAttributes[SEMRESATTRS_PROCESS_RUNTIME_VERSION] = process.version;

  // Create base resource from attributes
  let resource = resourceFromAttributes(resourceAttributes);

  // Apply automatic detectors
  const defaultDetectors = [
    envDetector, // Environment variables (OTEL_RESOURCE_ATTRIBUTES)
    processDetector, // Process information
    hostDetector, // Host information
    osDetector, // OS information
    serviceInstanceIdDetector, // Service instance ID
  ];

  // Merge with detected resources
  // Note: Custom detectors need to match ResourceDetector interface
  const allDetectors = [...defaultDetectors];
  const detectedResources = detectResources({
    detectors: allDetectors,
  });

  // Merge detected resources with our custom attributes
  resource = resource.merge(detectedResources);

  // Add cloud provider detection if available
  // AWS
  if (process.env.AWS_EXECUTION_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    resource = resource.merge(
      resourceFromAttributes({
        'cloud.provider': 'aws',
        'cloud.platform': process.env.AWS_EXECUTION_ENV || 'aws_lambda',
        ...(process.env.AWS_REGION && { 'cloud.region': process.env.AWS_REGION }),
        ...(process.env.AWS_LAMBDA_FUNCTION_NAME && {
          'faas.name': process.env.AWS_LAMBDA_FUNCTION_NAME,
        }),
        ...(process.env.AWS_LAMBDA_FUNCTION_VERSION && {
          'faas.version': process.env.AWS_LAMBDA_FUNCTION_VERSION,
        }),
      })
    );
  }

  // GCP
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    const gcpAttributes: Record<string, string> = {
      'cloud.provider': 'gcp',
      'cloud.account.id': process.env.GOOGLE_CLOUD_PROJECT,
    };
    if (process.env.GCP_REGION) {
      gcpAttributes['cloud.region'] = process.env.GCP_REGION;
    }
    if (process.env.GCP_ZONE) {
      gcpAttributes['cloud.availability_zone'] = process.env.GCP_ZONE;
    }
    resource = resource.merge(resourceFromAttributes(gcpAttributes));
  }

  // Azure
  if (process.env.WEBSITE_SITE_NAME) {
    const azureAttributes: Record<string, string> = {
      'cloud.provider': 'azure',
      'cloud.platform': 'azure_app_service',
      'service.name': process.env.WEBSITE_SITE_NAME,
    };
    if (process.env.REGION_NAME) {
      azureAttributes['cloud.region'] = process.env.REGION_NAME;
    }
    resource = resource.merge(resourceFromAttributes(azureAttributes));
  }

  // Kubernetes
  if (process.env.KUBERNETES_SERVICE_HOST) {
    resource = resource.merge(
      resourceFromAttributes({
        'k8s.cluster.name': process.env.KUBERNETES_CLUSTER_NAME || 'unknown',
        'k8s.namespace.name': process.env.KUBERNETES_NAMESPACE || 'default',
        'k8s.pod.name': process.env.KUBERNETES_POD_NAME || 'unknown',
        'k8s.pod.uid': process.env.KUBERNETES_POD_UID || 'unknown',
        'k8s.node.name': process.env.KUBERNETES_NODE_NAME || 'unknown',
      })
    );
  }

  // Docker
  if (process.env.DOCKER_CONTAINER_ID) {
    const dockerAttributes: Record<string, string> = {
      'container.id': process.env.DOCKER_CONTAINER_ID,
      'container.name': process.env.DOCKER_CONTAINER_NAME || 'unknown',
      'container.image.name': process.env.DOCKER_IMAGE_NAME || 'unknown',
    };
    if (process.env.DOCKER_IMAGE_TAG) {
      dockerAttributes['container.image.tag'] = process.env.DOCKER_IMAGE_TAG;
    }
    resource = resource.merge(resourceFromAttributes(dockerAttributes));
  }

  return resource;
}
