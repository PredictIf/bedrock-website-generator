import { RegionOptions } from "./../node_modules/aws-cdk/lib/api/aws-auth/awscli-compatible.d";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipelineActions from "aws-cdk-lib/aws-codepipeline-actions";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { DeployBackendConstruct } from "./constructs/DeployBackendConstruct";
import { DeployFrontendConstruct } from "./constructs/DeployFrontendConstruct";
import * as path from "path";
import { CodePipelineSource } from "aws-cdk-lib/pipelines";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

const GITHUB_CONNECTION_ARN =
  "arn:aws:codestar-connections:us-east-2:471112680679:connection/6062bf2d-54a8-4b04-89ee-eec48c47e55b";

const SECRET_ARN =
  "arn:aws:secretsmanager:us-east-1:221082206129:secret:website-generator-oauth-token-2fdCfT";

export class DeploymentPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // const repository = new codecommit.Repository(this, 'Repository', {
    //   repositoryName: 'voice-to-code',
    // });

    // const repository = CodePipelineSource.connection(
    //   "PredictIf",
    //   "bedrock-website-generator",
    //   {
    //     connectionArn: GITHUB_CONNECTION_ARN,
    //   }
    // );

    // new ssm.StringParameter(this, "RepositoryName", {
    //   parameterName: "/codecommit/repository/name",
    //   stringValue: "bedrock-website-generator",
    // });

    const ArtifactBucket = new s3.Bucket(this, "ArtifactBucket", {});
    const sourceArtifact = new codepipeline.Artifact();

    const deployPipeline = new codepipeline.Pipeline(this, "DeployPipeline", {
      pipelineName: "Deploy-Pipeline",
      stages: [
        {
          stageName: "Source",
          actions: [
            new codepipelineActions.GitHubSourceAction({
              actionName: "SoruceBackend",
              owner: "PredictIf",
              repo: "bedrock-website-generator",
              branch: "main",
              output: sourceArtifact,
              oauthToken: Secret.fromSecretAttributes(this, "Secret", {
                secretCompleteArn: SECRET_ARN,
              }).secretValue,
            }),
            // new codepipelineActions.CodeCommitSourceAction({
            //   actionName: "SourceBackend",
            //   repository: repository,
            //   branch: "main",
            //   output: sourceArtifact,
            // }),
          ],
        },
      ],
      artifactBucket: ArtifactBucket,
    });

    deployPipeline.addStage({
      stageName: "DeployBackend",
      actions: [
        new codepipelineActions.CodeBuildAction({
          actionName: "DeployBackend",
          project: new DeployBackendConstruct(this, "DeployBackendConstruct")
            .project,
          input: sourceArtifact,
        }),
      ],
    });

    deployPipeline.addStage({
      stageName: "DeployFrontend",
      actions: [
        new codepipelineActions.CodeBuildAction({
          actionName: "DeployFrontend",
          project: new DeployFrontendConstruct(this, "DeployFrontendConstruct")
            .project,
          input: sourceArtifact,
        }),
      ],
    });
  }
}
