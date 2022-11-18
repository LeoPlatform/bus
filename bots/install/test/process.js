let environments = {
	ProdCup: {
		Resources: {
			LeoStream: "ProdBus-LeoStream-1RWIW0AV7AC0Y",
			LeoCron: "ProdBus-LeoCron-CNT18F32S1UK",
			LeoEvent: "ProdBus-LeoEvent-12AQ6PZNRRHNK",
			LeoSettings: "ProdBus-LeoSettings-6FLTMJUIOS7Q",
			LeoSystem: "ProdBus-LeoSystem-1J1ZWZIGL7M3F",
			LeoS3: "prodbus-leos3-17uqyaemyrrxs",
			LeoKinesisStream: "ProdBus-LeoKinesisStream-1SZPWFHEKF669",
			LeoFirehoseStream: "ProdBus-LeoFirehoseStream-1GZRLNQ9YN9BK",
			Region: "us-east-1"
		}
	},
	StagingCup: {
		
		Resources: {
			LeoStream: "StagingBus-LeoStream-1BVXCM5IGNFA4",
			LeoCron: "StagingBus-LeoCron-2UVDDFZR2MCT",
			LeoEvent: "StagingBus-LeoEvent-MMS1VQKHYE3A",
			LeoSettings: "StagingBus-LeoSettings-154YXMK35SY6X",
			LeoSystem: "StagingBus-LeoSystem-ZRAGVB31ATR8",
			LeoS3: "stagingbus-leos3-1mta8a98wcbnc",
			LeoKinesisStream: "StagingBus-LeoKinesisStream-A4FQ23IVQ11K",
			LeoFirehoseStream: "StagingBus-LeoFirehoseStream-1XNB5CU9DAIRF",
			Region: "us-east-1"

		}
	},
	TestCup: {
		
		Resources: {
			LeoStream: "TestBus-LeoStream-R2VV0EJ6FRI9",
			LeoCron: "TestBus-LeoCron-OJ8ZNCEBL8GM",
			LeoEvent: "TestBus-LeoEvent-FNSO733D68CR",
			LeoSettings: "TestBus-LeoSettings-YHQHOKWR337E",
			LeoSystem: "TestBus-LeoSystem-L9OY6AV8E954",
			LeoS3: "testbus-leos3-1erchsf3l53le",
			LeoKinesisStream: "TestBus-LeoKinesisStream-1XY97YYPDLVQS",
			LeoFirehoseStream: "TestBus-LeoFirehoseStream-1M8BJL0I5HQ34",
			Region: "us-east-1"
		}
	},
	ProdChub: {
		Resources: {
			LeoStream: "ProdChubBus-LeoStream-1L646F8GY5QK3",
			LeoCron: "ProdChubBus-LeoCron-1U2142Z24Y2JO",
			LeoEvent: "ProdChubBus-LeoEvent-14X2791QV7EYB",
			LeoSettings: "ProdChubBus-LeoSettings-6C1O800CPYXR",
			LeoSystem: "ProdChubBus-LeoSystem-JC6RK6Y85QTP",
			LeoS3: "prodchubbus-leos3-e0ia450en9r3",
			LeoKinesisStream: "ProdChubBus-LeoKinesisStream-hMhVKABDg9rp",
			LeoFirehoseStream: "ProdChubBus-LeoFirehoseStream-FhM3OowPU0qG",
			Region: "us-east-1"
		}
	},
	StagingChub: {
		Resources: {
			LeoStream: "StagingChubBus-LeoStream-R0SGBTMQV0CO",
			LeoCron: "StagingChubBus-LeoCron-1GT3DZNZCXX0W",
			LeoEvent: "StagingChubBus-LeoEvent-1U2QJ0UG87GN4",
			LeoSettings: "StagingChubBus-LeoSettings-14WTN4OGY48PE",
			LeoSystem: "StagingChubBus-LeoSystem-AOZRX1AE1GNH",
			LeoS3: "stagingchubbus-leos3-1umuxd085pnpo",
			LeoKinesisStream: "StagingChubBus-LeoKinesisStream-F8vsGLC2PQXd",
			LeoFirehoseStream: "StagingChubBus-LeoFirehoseStream-FKPZGoqYf6ip",
			Region: "us-east-1"
		}
	},
	TestChub: {
		Resources: {
			LeoStream: "TestChubBus-LeoStream-11GR17W7KEYBM",
			LeoCron: "TestChubBus-LeoCron-3ILWRF1XIBQW",
			LeoEvent: "TestChubBus-LeoEvent-17MTJCT3BHJ6L",
			LeoSettings: "TestChubBus-LeoSettings-A1SYQYK2I2K8",
			LeoSystem: "TestChubBus-LeoSystem-1237JJCMSFIYS",
			LeoS3: "testchubbus-leos3-1j5bnlg02psx2",
			LeoKinesisStream: "TestChubBus-LeoKinesisStream-x5eCGHLiI34m",
			LeoFirehoseStream: "TestChubBus-LeoFirehoseStream-NF6oQiNWdYc5",
			Region: "us-east-1"
		}

	},
	ProdStream: {
		Resources: {
			LeoStream: "ProdStreamBus-LeoStream-W2JIHQIJSDBW",
			LeoCron: "ProdStreamBus-LeoCron-1QC2GT4QE795",
			LeoEvent: "ProdStreamBus-LeoEvent-N4AIRRII8DOH",
			LeoSettings: "ProdStreamBus-LeoSettings-1XRHEZ8WJFEXD",
			LeoSystem: "ProdStreamBus-LeoSystem-1NOPPW98DBVSO",
			LeoS3: "prodstreambus-leos3-8ho0fqcs6w5a",
			LeoKinesisStream: "ProdStreamBus-LeoKinesisStream-1WQIKD45KPYIZ",
			LeoFirehoseStream: "ProdStreamBus-LeoFirehoseStream-OX07A1GWL2PW",
			Region: "us-east-1"

		}
	},
	StagingStream: {
		Resources: {
			LeoStream: "StagingStreamBus-LeoStream-1M7FYPSKAV706",
			LeoCron: "StagingStreamBus-LeoCron-15Q6RWD3GIW5",
			LeoEvent: "StagingStreamBus-LeoEvent-1RILW0ALGU7RM",
			LeoSettings: "StagingStreamBus-LeoSettings-FKTZA9NR59KY",
			LeoSystem: "StagingStreamBus-LeoSystem-1MDWZXM4DZP6",
			LeoS3: "stagingstreambus-leos3-1f8py7plxi1kn",
			LeoKinesisStream: "StagingStreamBus-LeoKinesisStream-1CBY7MHIH8TIO",
			LeoFirehoseStream: "StagingStreamBus-LeoFirehoseStream-1T646Q3AZV1BK",
			Region: "us-east-1"
		}
	},
	TestStream: {
		Resources: {
			LeoStream: "TestStreamBus-LeoStream-7GHYTIYZM8Q4",
			LeoCron: "TestStreamBus-LeoCron-WGEIE71LLTKY",
			LeoEvent: "TestStreamBus-LeoEvent-1S7R9M1723ZT1",
			LeoSettings: "TestStreamBus-LeoSettings-X70JO3QOGUPF",
			LeoSystem: "TestStreamBus-LeoSystem-KFS5SDD5TQGZ",
			LeoS3: "teststreambus-leos3-1nb3zt3i4nffe",
			LeoKinesisStream: "TestStreamBus-LeoKinesisStream-18Y8B6A9RSPUU",
			LeoFirehoseStream: "TestStreamBus-LeoFirehoseStream-1CE9PM66L5E2V",
			Region: "us-east-1"
		}
	},
	Playground: {
		Resources: {
			LeoStream: "PlaygroundBus-Bus-1JX7JSIIUQRAO-LeoStream-10UYRE1C2NIOR",
			LeoCron: "PlaygroundBus-Bus-1JX7JSIIUQRAO-LeoCron-I1L2LWC30GYB",
			LeoEvent: "PlaygroundBus-Bus-1JX7JSIIUQRAO-LeoEvent-1WGF24N9QULPH",
			LeoSettings: "PlaygroundBus-Bus-1JX7JSIIUQRAO-LeoSettings-YCMMUI466HF5",
			LeoSystem: "PlaygroundBus-Bus-1JX7JSIIUQRAO-LeoSystem-1SH8HLHFSYZRW",
			LeoS3: "playgroundbus-bus-1jx7jsiiuqrao-leos3-tjvapqkh5m34",
			LeoKinesisStream: "PlaygroundBus-Bus-1JX7JSIIUQRAO-LeoKinesisStream-woaMoz6jOtsC",
			LeoFirehoseStream: "PlaygroundBus-Bus-1JX7JSIIUQRAO-LeoFirehoseStream-TNl9LQYSNXjm",
			Region: "us-east-1"
		}
	},
	Clint: {
		Resources: {
			Region: "us-west-2",
			LeoStream: "ClintTestBus-Bus-1AU1ENWIRG4NO-LeoStream-CD0LNNEV8061",
			LeoCron: "ClintTestBus-Bus-1AU1ENWIRG4NO-LeoCron-WOYLDTIP8JNB",
			LeoEvent: "ClintTestBus-Bus-1AU1ENWIRG4NO-LeoEvent-1XTUN5FG6W5FH",
			LeoS3: "clinttestbus-bus-1au1enwirg4no-leos3-feq3u3g89jgu",
			LeoKinesisStream: "ClintTestBus-Bus-1AU1ENWIRG4NO-LeoKinesisStream-n0KNkKCuP8EJ",
			LeoFirehoseStream: "ClintTestBus-Bus-1AU1ENWIRG4NO-LeoFirehoseStream-4AGnnPEP5kml",
			LeoSettings: "ClintTestBus-Bus-1AU1ENWIRG4NO-LeoSettings-G4YOJX6ESM17",
			LeoSystem: "ClintTestBus-Bus-1AU1ENWIRG4NO-LeoSystem-19AX98JJWFBUS"
		}

	},
	old_env: {
		Resources: {
			Region: "us-west-2",
			LeoArchive: "LeoDev-Bus-NQQPNFKOGCH0-LeoArchive-EEUAJWFNPBID",
			LeoCron: "LeoDev-Bus-NQQPNFKOGCH0-LeoCron-MHLFTV8UVHHM",
			LeoEvent: "LeoDev-Bus-NQQPNFKOGCH0-LeoEvent-1DQB1MJ403WL6",
			LeoFirehoseStream: "LeoDev-Bus-NQQPNFKOGCH0-LeoFirehoseStream-1I78RJ40WKDO1",
			LeoKinesisStream: "LeoDev-Bus-NQQPNFKOGCH0-LeoKinesisStream-6PM8JSB8ZEVB",
			LeoS3: "leodev-bus-nqqpnfkogch0-leos3-10ht2jx9t1qms",
			LeoSettings: "LeoDev-Bus-NQQPNFKOGCH0-LeoSettings-651QFVERENVL",
			LeoStream: "LeoDev-Bus-NQQPNFKOGCH0-LeoStream-Q20RWP2LACKI",
			LeoSystem: "LeoDev-Bus-NQQPNFKOGCH0-LeoSystem-HN2NII97GGG5"

		}
	}
};

const config = environments[process.env.bus] || Object.values(environments)[0];
// config.StackName = config.Resources.LeoStats.replace(/-LeoStats-.*$/, "");
// config.Resources.CognitoId = "";
config.BusName = (config.Resources.LeoKinesisStream).replace(/-LeoKinesisStream-.*$/, "");
module.exports = {
	env: config
}

console.log(`Connecting to Bus: ${config.BusName}`);